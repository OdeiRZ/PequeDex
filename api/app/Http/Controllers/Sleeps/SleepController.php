<?php

namespace App\Http\Controllers\Sleeps;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sleeps\StoreSleepRequest;
use App\Http\Requests\Sleeps\UpdateSleepRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SleepController extends Controller
{
    public function index(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $since = $request->validate(['since' => ['nullable', 'date']])['since'] ?? null;

        $query = $baby->sleeps()->orderByDesc('started_at');

        // Used by the frontend's weekly sleep chart, which only needs a
        // recent window, not the baby's whole history. A sleep counts as
        // "in" the window if any part of it falls on or after `since` -
        // matched on started_at OR ended_at (not started_at alone) so a
        // nap that began before the window but is still ongoing, or ended
        // just inside it, isn't silently dropped from the total.
        if ($since !== null) {
            $query->where(function ($q) use ($since) {
                $q->where('started_at', '>=', $since)
                    ->orWhere('ended_at', '>=', $since)
                    ->orWhereNull('ended_at');
            });
        }

        return response()->json(['data' => $query->get()]);
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
