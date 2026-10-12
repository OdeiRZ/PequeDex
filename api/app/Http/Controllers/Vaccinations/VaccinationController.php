<?php

namespace App\Http\Controllers\Vaccinations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vaccinations\SaveVaccinationRequest;
use App\Http\Requests\Vaccinations\UpdateVaccinationSettingsRequest;
use App\Models\Baby;
use App\Services\Vaccinations\VaccinationTemplates;
use Illuminate\Http\JsonResponse;

class VaccinationController extends Controller
{
    /**
     * Las vacunas del bebé por fecha prevista, más qué plantilla se le
     * aplica (fuente y año, y si es propia de su comunidad o la común) -
     * la pantalla lo muestra para que se sepa de dónde sale la lista.
     */
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json([
            'data' => $baby->vaccinations()->orderByRaw('due_date is null')->orderBy('due_date')->orderBy('id')->get(),
            'template' => $this->templateInfo($baby),
        ]);
    }

    /**
     * Activar/desactivar y elegir la comunidad autónoma. Al activar por
     * primera vez se genera la lista desde la plantilla; al cambiar de
     * comunidad se rehacen las de plantilla todavía sin poner. Desactivar
     * no borra nada - reactivar más tarde recupera lo que había.
     */
    public function updateSettings(UpdateVaccinationSettingsRequest $request, Baby $baby): JsonResponse
    {
        $previousRegion = $baby->region;
        $baby->update($request->validated());

        if ($baby->vaccinations_enabled) {
            if ($previousRegion !== $baby->region && $baby->vaccinations()->whereNotNull('code')->exists()) {
                VaccinationTemplates::regenerateFor($baby);
            } else {
                VaccinationTemplates::generateFor($baby);
            }
        }

        return response()->json([
            'baby' => $baby->fresh(),
            'data' => $baby->vaccinations()->orderByRaw('due_date is null')->orderBy('due_date')->orderBy('id')->get(),
            'template' => $this->templateInfo($baby),
        ]);
    }

    public function store(SaveVaccinationRequest $request, Baby $baby): JsonResponse
    {
        $vaccination = $baby->vaccinations()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $vaccination], 201);
    }

    public function update(SaveVaccinationRequest $request, Baby $baby, int $vaccination): JsonResponse
    {
        $model = $baby->vaccinations()->findOrFail($vaccination);
        $model->fill([...$request->validated(), 'user_id' => $request->user()->id]);

        // Marcar como puesta no cuenta como "editada": solo lo que la
        // plantilla nueva o una fecha de nacimiento nueva pisarían.
        if ($model->code !== null) {
            $dueDateChanged = $model->isDirty('due_date');
            $model->edited = $model->edited || $dueDateChanged || $model->isDirty(['name', 'notes']);
            $model->due_date_edited = $model->due_date_edited || $dueDateChanged;
        }
        $model->save();

        return response()->json(['data' => $model]);
    }

    public function destroy(Baby $baby, int $vaccination): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->vaccinations()->findOrFail($vaccination)->delete();

        return response()->json(status: 204);
    }

    /**
     * @return array{source: string, year: int, region_specific: bool}
     */
    private function templateInfo(Baby $baby): array
    {
        $template = VaccinationTemplates::forRegion($baby->region);

        return [
            'source' => $template['source'],
            'year' => $template['year'],
            'region_specific' => $template['region_specific'],
        ];
    }
}
