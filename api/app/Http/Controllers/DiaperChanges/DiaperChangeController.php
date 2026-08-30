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

    public function store(StoreDiaperChangeRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $diaperChange = $baby->diaperChanges()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $diaperChange], 201);
    }

    public function update(UpdateDiaperChangeRequest $request, Baby $baby, int $diaperChange): JsonResponse
    {
        $this->authorize('update', $baby);

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
