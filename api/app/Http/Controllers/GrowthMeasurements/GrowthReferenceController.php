<?php

namespace App\Http\Controllers\GrowthMeasurements;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use App\Services\Growth\WhoGrowthStandards;
use Illuminate\Http\JsonResponse;

/**
 * Curvas de referencia de la OMS (percentiles 3/15/50/85/97, mes a mes de
 * 0 a 24 meses) para el sexo de este bebé, que "Crecimiento" dibuja como
 * bandas detrás de su propia línea. Las tablas LMS ya viven en el
 * backend (WhoGrowthStandards, de donde salen también los percentiles de
 * cada medición), así que se sirven desde aquí en vez de duplicarlas en
 * el frontend. `curves: null` si el bebé no tiene sexo o fecha de
 * nacimiento - sin ellos no hay curva con la que comparar, mismo
 * criterio que los percentiles a null de GrowthMeasurementController.
 */
class GrowthReferenceController extends Controller
{
    public function show(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        if ($baby->sex === null || $baby->birth_date === null) {
            return response()->json(['data' => ['curves' => null]]);
        }

        $sex = $baby->sex->whoTableKey();

        return response()->json(['data' => [
            'curves' => [
                'weight' => WhoGrowthStandards::referenceCurves('weight', $sex),
                'height' => WhoGrowthStandards::referenceCurves('height', $sex),
                'head_circumference' => WhoGrowthStandards::referenceCurves('head_circumference', $sex),
            ],
        ]]);
    }
}
