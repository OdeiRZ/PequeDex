<?php

namespace App\Http\Controllers\Feeds;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feeds\StoreFeedRequest;
use App\Http\Requests\Feeds\UpdateFeedRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;

class FeedController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->feeds()->orderByDesc('started_at')->get()]);
    }

    public function store(StoreFeedRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $feed = $baby->feeds()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $feed], 201);
    }

    public function update(UpdateFeedRequest $request, Baby $baby, int $feed): JsonResponse
    {
        $this->authorize('update', $baby);

        // Fetched through the baby's own relationship, not a bare
        // Feed::findOrFail($feed) - guarantees the feed actually belongs
        // to this baby (and not some other one the URL's own {baby}
        // segment doesn't match) rather than trusting the two route
        // segments agree with each other.
        $feedModel = $baby->feeds()->findOrFail($feed);
        $feedModel->update($request->validated());

        return response()->json(['data' => $feedModel]);
    }

    public function destroy(Baby $baby, int $feed): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->feeds()->findOrFail($feed)->delete();

        return response()->json(status: 204);
    }
}
