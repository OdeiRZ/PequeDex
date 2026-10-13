<?php

namespace App\Http\Controllers\Temperatures;

use App\Http\Controllers\Concerns\CreatesIdempotently;
use App\Http\Controllers\Controller;
use App\Http\Requests\Temperatures\StoreTemperatureRequest;
use App\Http\Requests\Temperatures\UpdateTemperatureRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class TemperatureController extends Controller
{
    use CreatesIdempotently;

    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->temperatures()->orderByDesc('measured_at')->limit(self::INDEX_LIMIT)->get()]);
    }

    // Store/UpdateTemperatureRequest authorize themselves (via
    // AuthorizesBabyAccess), same as the diaper change controller.
    public function store(StoreTemperatureRequest $request, Baby $baby): JsonResponse
    {
        return $this->createOnce($baby->temperatures(), [
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);
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
