<?php

namespace App\Http\Controllers\VitaminD;

use App\Http\Controllers\Controller;
use App\Http\Requests\VitaminD\UpsertVitaminDDoseRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class VitaminDDoseController extends Controller
{
    /**
     * Unlike VitaminDScheduleController::show()'s recent_doses (capped
     * to 14 days for the Dashboard editor), this returns the full
     * history - Estadísticas needs every dose ever logged, including
     * ones from a pauta that already ended, to compute "given/total_days".
     */
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->vitaminDDoses()->orderByDesc('date')->get()]);
    }

    // UpsertVitaminDDoseRequest authorizes itself (via AuthorizesBabyAccess)
    // before rules()/withValidator() run.
    public function upsert(UpsertVitaminDDoseRequest $request, Baby $baby): JsonResponse
    {
        // baby_id + date is the natural key - marking or correcting a day
        // is the same operation, never a second row for that date.
        $dose = $baby->vitaminDDoses()->updateOrCreate(
            ['date' => $request->validated('date')],
            ['given' => $request->validated('given'), 'user_id' => $request->user()->id],
        );

        return response()->json(['data' => $dose]);
    }
}
