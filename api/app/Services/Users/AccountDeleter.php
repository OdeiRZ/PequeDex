<?php

namespace App\Services\Users;

use App\Models\Baby;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Borra una cuenta y lo que solo era suyo.
 *
 *  - Bebés de los que era el ÚNICO cuidador: se borran con todo su historial
 *    y las fotos de sus hitos (sin cuidadores no queda nadie que pueda verlos).
 *  - Bebés compartidos: el otro cuidador conserva todo, incluido lo que esta
 *    persona había anotado (los registros pierden el autor, no se borran; ver
 *    la migración `keep_entries_when_their_author_is_deleted`).
 *  - Sesiones, avatar y "me gusta" desaparecen con la cuenta.
 */
class AccountDeleter
{
    /**
     * @return array{babies_deleted: int, babies_left: int}
     */
    public function delete(User $user): array
    {
        return DB::transaction(function () use ($user) {
            $deleted = 0;
            $left = 0;

            foreach ($user->babies()->get() as $baby) {
                // Bloqueo del bebé: si el otro cuidador abandona justo ahora,
                // el recuento de abajo no puede quedar desfasado.
                Baby::whereKey($baby->id)->lockForUpdate()->firstOrFail();

                if ($baby->users()->count() <= 1) {
                    $this->deleteBaby($baby);
                    $deleted++;
                } else {
                    $baby->users()->detach($user);
                    $left++;
                }
            }

            $user->tokens()->delete();
            $user->delete();

            return ['babies_deleted' => $deleted, 'babies_left' => $left];
        });
    }

    private function deleteBaby(Baby $baby): void
    {
        $photoPaths = $baby->milestones()->whereNotNull('photo_path')->pluck('photo_path');
        if ($photoPaths->isNotEmpty()) {
            Storage::disk(config('filesystems.milestones_disk'))->delete($photoPaths->all());
        }

        $baby->delete();
    }
}
