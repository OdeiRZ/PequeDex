<?php

namespace App\Http\Controllers\DiaperChanges;

use App\Http\Controllers\Controller;
use App\Http\Requests\DiaperChanges\StoreDiaperChangeRequest;
use App\Http\Requests\DiaperChanges\UpdateDiaperChangeRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class DiaperChangeController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->diaperChanges()->orderByDesc('changed_at')->get()]);
    }

    // StoreDiaperChangeRequest/UpdateDiaperChangeRequest authorize
    // themselves (via AuthorizesBabyAccess) - before rules() runs, not
    // after, unlike an explicit $this->authorize() here would be (see
    // that trait's own docblock for why the difference matters for this
    // baby's data).
    public function store(StoreDiaperChangeRequest $request, Baby $baby): JsonResponse
    {
        $diaperChange = $baby->diaperChanges()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $diaperChange], 201);
    }

    public function update(UpdateDiaperChangeRequest $request, Baby $baby, int $diaperChange): JsonResponse
    {
        $diaperChangeModel = $baby->diaperChanges()->findOrFail($diaperChange);
        $diaperChangeModel->update($request->validated());

        return response()->json(['data' => $diaperChangeModel]);
    }

    public function destroy(Baby $baby, int $diaperChange): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->diaperChanges()->findOrFail($diaperChange)->delete();

        return response()->json(status: 204);
    }
}
