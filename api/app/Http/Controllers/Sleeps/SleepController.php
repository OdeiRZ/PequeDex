<?php

namespace App\Http\Controllers\Sleeps;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sleeps\StoreSleepRequest;
use App\Http\Requests\Sleeps\UpdateSleepRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class SleepController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->sleeps()->orderByDesc('started_at')->get()]);
    }

    public function store(StoreSleepRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $sleep = $baby->sleeps()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $sleep], 201);
    }

    public function update(UpdateSleepRequest $request, Baby $baby, int $sleep): JsonResponse
    {
        $this->authorize('update', $baby);

        $sleepModel = $baby->sleeps()->findOrFail($sleep);
        $sleepModel->update($request->validated());

        return response()->json(['data' => $sleepModel]);
    }

    public function destroy(Baby $baby, int $sleep): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->sleeps()->findOrFail($sleep)->delete();

        return response()->json(status: 204);
    }
}
