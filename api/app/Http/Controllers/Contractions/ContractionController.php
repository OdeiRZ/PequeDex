<?php

namespace App\Http\Controllers\Contractions;

use App\Http\Controllers\Controller;
use App\Http\Requests\Contractions\StoreContractionRequest;
use App\Http\Requests\Contractions\UpdateContractionRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class ContractionController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->contractions()->orderByDesc('started_at')->get()]);
    }

    // StoreContractionRequest/UpdateContractionRequest authorize
    // themselves (via AuthorizesBabyAccess) - same reasoning as
    // SleepController.
    public function store(StoreContractionRequest $request, Baby $baby): JsonResponse
    {
        $contraction = $baby->contractions()->create([
            'started_at' => $request->validated('started_at') ?? now(),
            'user_id' => $request->user()->id,
            // Set explicitly, not left to the migration's DB-level
            // default: Eloquent's create() reflects back only what was
            // passed in, so an omitted key comes back null in the JSON
            // response even though the DB row itself got 0.
            'intensity' => 0,
            // Same reasoning: without this, the key is missing from the
            // JSON response entirely (not even `null`), so the frontend's
            // `ended_at === null` check to detect the running contraction
            // never matches and the start/stop button gets stuck.
            'ended_at' => null,
        ]);

        return response()->json(['data' => $contraction], 201);
    }

    public function update(UpdateContractionRequest $request, Baby $baby, int $contraction): JsonResponse
    {
        $contractionModel = $baby->contractions()->findOrFail($contraction);
        $contractionModel->update($request->validated());

        return response()->json(['data' => $contractionModel]);
    }

    public function destroy(Baby $baby, int $contraction): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->contractions()->findOrFail($contraction)->delete();

        return response()->json(status: 204);
    }

    // Bulk reset for a false alarm - practice contractions days before
    // the real thing, with nothing worth keeping row-by-row. Same
    // authorization as destroy() (an edit-level action, not just view).
    public function destroyAll(Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->contractions()->delete();

        return response()->json(status: 204);
    }
}
