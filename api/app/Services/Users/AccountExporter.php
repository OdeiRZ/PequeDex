<?php

namespace App\Services\Users;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Todos los datos de una cuenta en un único JSON (portabilidad, RGPD): el
 * perfil y, de cada bebé que cuida, sus datos y todos sus registros.
 *
 * Qué NO lleva: la contraseña ni los tokens; los correos de los demás
 * cuidadores (solo cuántos son); las fotos de los hitos (solo si tienen).
 */
class AccountExporter
{
    /**
     * @return array<string, mixed>
     */
    public function export(User $user): array
    {
        return [
            'exported_at' => now()->toIso8601String(),
            'account' => $user->makeHidden(['avatar', 'avatarRecord'])->toArray(),
            'babies' => $user->babies()->orderBy('baby_user.created_at')->orderBy('babies.id')->get()
                ->map(fn ($baby) => [
                    'baby' => $baby->makeHidden('pivot')->toArray(),
                    'caregivers' => $baby->users()->count(),
                    'feeds' => $this->rows($baby->feeds()->orderBy('started_at')->get()),
                    'sleeps' => $this->rows($baby->sleeps()->orderBy('started_at')->get()),
                    'diaper_changes' => $this->rows($baby->diaperChanges()->orderBy('changed_at')->get()),
                    'temperatures' => $this->rows($baby->temperatures()->orderBy('measured_at')->get()),
                    'growth_measurements' => $this->rows($baby->growthMeasurements()->orderBy('measured_at')->get()),
                    'milestones' => array_map(function (array $row) {
                        // Las fotos no se incluyen (son URLs que caducan); sí si había.
                        $row['has_photo'] = ! empty($row['photo_path']);
                        unset($row['photo_path'], $row['photo_url']);

                        return $row;
                    }, $this->rows($baby->milestones()->orderBy('achieved_at')->get())),
                    'contractions' => $this->rows($baby->contractions()->orderBy('started_at')->get()),
                    'vaccinations' => $this->rows($baby->vaccinations()->orderBy('id')->get()),
                    'checkups' => $this->rows($baby->checkups()->orderBy('scheduled_at')->get()),
                    'vitamin_d_schedule' => $baby->vitaminDSchedule?->makeHidden('user_id')->toArray(),
                    'vitamin_d_doses' => $this->rows($baby->vitaminDDoses()->orderBy('date')->get()),
                ])->all(),
        ];
    }

    /**
     * @param  iterable<int, Model>  $models
     * @return list<array<string, mixed>>
     */
    private function rows(iterable $models): array
    {
        // `user_id` se omite: es un identificador interno del autor, y el de
        // otros cuidadores no es dato de esta persona.
        return collect($models)->map(fn (Model $model) => $model->makeHidden('user_id')->toArray())->values()->all();
    }
}
