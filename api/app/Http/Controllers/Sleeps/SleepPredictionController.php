<?php

namespace App\Http\Controllers\Sleeps;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use App\Services\Sleep\SleepPatternPredictor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SleepPredictionController extends Controller
{
    /**
     * `?tz=Europe/Madrid`: zona horaria del móvil, para saber qué sueños
     * son de noche (el servidor trabaja en UTC). Una zona desconocida o
     * ausente se trata como UTC en vez de dar error - la predicción es
     * orientativa y sigue saliendo.
     */
    public function show(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $timezone = $request->query('tz');
        if (! is_string($timezone) || ! in_array($timezone, timezone_identifiers_list(), true)) {
            $timezone = 'UTC';
        }

        return response()->json(['data' => SleepPatternPredictor::predict($baby, $timezone)]);
    }
}
