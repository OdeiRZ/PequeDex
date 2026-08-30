<?php

namespace App\Http\Controllers\Sleeps;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use App\Services\Sleep\SleepPatternPredictor;
use Illuminate\Http\JsonResponse;

class SleepPredictionController extends Controller
{
    public function show(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => SleepPatternPredictor::predict($baby)]);
    }
}
