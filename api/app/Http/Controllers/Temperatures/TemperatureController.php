<?php

namespace App\Http\Controllers\Temperatures;

use App\Http\Controllers\Controller;
use App\Http\Requests\Temperatures\StoreTemperatureRequest;
use App\Http\Requests\Temperatures\UpdateTemperatureRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class TemperatureController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->temperatures()->orderByDesc('measured_at')->get()]);
    }

    // Store/UpdateTemperatureRequest authorize themselves (via
    // AuthorizesBabyAccess), same as the diaper change controller.
    public function store(StoreTemperatureRequest $request, Baby $baby): JsonResponse
    {
        $temperature = $baby->temperatures()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $temperature], 201);
    }

    public function update(UpdateTemperatureRequest $request, Baby $baby, int $temperature): JsonResponse
    {
        $temperatureModel = $baby->temperatures()->findOrFail($temperature);
        $temperatureModel->update($request->validated());

        return response()->json(['data' => $temperatureModel]);
    }

    public function destroy(Baby $baby, int $temperature): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->temperatures()->findOrFail($temperature)->delete();

        return response()->json(status: 204);
    }
}
