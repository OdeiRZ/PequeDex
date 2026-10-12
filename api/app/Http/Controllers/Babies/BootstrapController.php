<?php

namespace App\Http\Controllers\Babies;

use App\Http\Controllers\Controller;
use App\Http\Controllers\DiaperChanges\DiaperChangeController;
use App\Http\Controllers\Feeds\FeedPredictionController;
use App\Http\Controllers\GrowthMeasurements\GrowthMeasurementController;
use App\Http\Controllers\Milestones\MilestoneController;
use App\Http\Controllers\Sleeps\SleepPredictionController;
use App\Http\Controllers\Temperatures\TemperatureController;
use App\Http\Controllers\Vaccinations\CheckupController;
use App\Http\Controllers\Vaccinations\VaccinationController;
use App\Http\Controllers\VitaminD\VitaminDScheduleController;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Todo lo que el Dashboard pide al abrir un bebé, en una sola petición.
 * Antes eran 8-10 peticiones en paralelo, y cada una pagaba su propia
 * conexión a la base de datos, su autenticación y su viaje de red: en
 * producción tardaban 1,6-3 s cada una y los datos no estaban completos
 * hasta ~4 s después. Cada sección es exactamente el cuerpo de la
 * respuesta del endpoint individual (se llama al mismo controlador), así
 * que el frontend las trata igual que antes y no pueden divergir.
 *
 * Parámetros opcionales, los mismos que los endpoints individuales: `tz`
 * (predicción de sueño) y `since` (pañales recientes).
 */
class BootstrapController extends Controller
{
    public function show(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $query = array_filter([
            'tz' => $request->query('tz'),
            'since' => $request->query('since'),
        ], fn ($value) => $value !== null);

        $sections = [
            'timeline' => fn (Request $r) => app(TimelineController::class)->index($r, $baby),
            'growth_measurements' => fn () => app(GrowthMeasurementController::class)->index($baby),
            'milestones' => fn () => app(MilestoneController::class)->index($baby),
            'sleep_prediction' => fn (Request $r) => app(SleepPredictionController::class)->show($r, $baby),
            'feed_prediction' => fn () => app(FeedPredictionController::class)->show($baby),
            'vitamin_d_schedule' => fn () => app(VitaminDScheduleController::class)->show($baby),
            'temperatures' => fn () => app(TemperatureController::class)->index($baby),
            'recent_diaper_changes' => fn (Request $r) => app(DiaperChangeController::class)->index($r, $baby),
        ];

        // Solo si están activadas para este bebé (igual que el Dashboard).
        if ($baby->vaccinations_enabled) {
            $sections['vaccinations'] = fn () => app(VaccinationController::class)->index($baby);
            $sections['checkups'] = fn () => app(CheckupController::class)->index($baby);
        }

        $body = [];
        foreach ($sections as $name => $section) {
            $sub = $request->duplicate($query);
            // La línea temporal contesta 304 a una petición condicional; aquí
            // hace falta siempre el cuerpo completo.
            $sub->headers->remove('If-None-Match');
            $response = $section($sub);
            $body[$name] = $response->getData(true);

            // La huella de la línea temporal, para que el primer sondeo ya
            // pueda ser condicional.
            if ($name === 'timeline') {
                $body['timeline_etag'] = $response->headers->get('ETag');
            }
        }

        return response()->json($body);
    }
}
