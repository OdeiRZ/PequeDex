<?php

namespace App\Http\Controllers\VitaminD;

use App\Http\Controllers\Controller;
use App\Http\Requests\VitaminD\UpsertVitaminDScheduleRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class VitaminDScheduleController extends Controller
{
    /**
     * recent_doses is capped to the last 14 days so the Dashboard's
     * retroactive editor can render without a separate request per day -
     * Estadísticas, which needs the full history, fetches doses on its
     * own endpoint instead (see VitaminDDoseController::index()).
     */
    public function show(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $schedule = $baby->vitaminDSchedule;

        return response()->json([
            'data' => $schedule,
            'recent_doses' => $schedule === null
                ? []
                : $baby->vitaminDDoses()
                    ->where('date', '>=', Carbon::today()->subDays(14)->toDateString())
                    ->orderByDesc('date')
                    ->get(),
        ]);
    }

    // UpsertVitaminDScheduleRequest authorizes itself (via
    // AuthorizesBabyAccess) before rules() runs - see that trait's
    // docblock for why that ordering matters.
    public function upsert(UpsertVitaminDScheduleRequest $request, Baby $baby): JsonResponse
    {
        // A single row per baby, reused across activate/deactivate
        // cycles - deactivating is just upsert with enabled:false,
        // which keeps the previous dates as a starting suggestion if
        // the caregiver reactivates later.
        $schedule = $baby->vitaminDSchedule()->updateOrCreate(
            [],
            [...$request->validated(), 'user_id' => $request->user()->id],
        );

        return response()->json(['data' => $schedule]);
    }
}
