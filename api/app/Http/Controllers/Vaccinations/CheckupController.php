<?php

namespace App\Http\Controllers\Vaccinations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vaccinations\SaveCheckupRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class CheckupController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->checkups()->orderBy('scheduled_at')->get()]);
    }

    public function store(SaveCheckupRequest $request, Baby $baby): JsonResponse
    {
        $checkup = $baby->checkups()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $checkup], 201);
    }

    public function update(SaveCheckupRequest $request, Baby $baby, int $checkup): JsonResponse
    {
        $model = $baby->checkups()->findOrFail($checkup);
        $model->update($request->validated());

        return response()->json(['data' => $model]);
    }

    public function destroy(Baby $baby, int $checkup): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->checkups()->findOrFail($checkup)->delete();

        return response()->json(status: 204);
    }
}
