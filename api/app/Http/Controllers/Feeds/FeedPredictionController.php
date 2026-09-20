<?php

namespace App\Http\Controllers\Feeds;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use App\Services\Feeds\FeedPatternPredictor;
use Illuminate\Http\JsonResponse;

class FeedPredictionController extends Controller
{
    public function show(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => FeedPatternPredictor::predict($baby)]);
    }
}
