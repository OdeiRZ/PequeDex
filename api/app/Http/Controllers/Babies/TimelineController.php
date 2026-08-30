<?php

namespace App\Http\Controllers\Babies;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    /**
     * Merges feeds/sleeps/diaper_changes into one chronological list -
     * lets the dashboard show a single timeline without firing 3
     * requests and merging them by hand. Merged and sorted in PHP rather
     * than a SQL UNION across three differently-shaped tables: a
     * personal family's own log never reaches a size (even years of
     * daily use stays in the low thousands of rows) where that matters
     * for the merge itself.
     *
     * Each of the three queries below is bounded to $limit rows *before*
     * the merge, though - the dashboard polls this endpoint every 5
     * seconds while it's open, so pulling every row of a baby's entire
     * history on every poll would make the query cost grow with the
     * child's whole lifetime instead of with what's actually displayed.
     * Taking the top $limit from each already-sorted-desc list is enough:
     * the true top-$limit of the merged result can never need more than
     * $limit rows from any single one of them.
     */
    public function index(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $limit = min($request->integer('limit', 50), 200);

        $entries = collect()
            ->concat($baby->feeds()->orderByDesc('started_at')->limit($limit)->get()->map(fn ($feed) => [
                'type' => 'feed',
                'at' => $feed->started_at,
                'data' => $feed,
            ]))
            ->concat($baby->sleeps()->orderByDesc('started_at')->limit($limit)->get()->map(fn ($sleep) => [
                'type' => 'sleep',
                'at' => $sleep->started_at,
                'data' => $sleep,
            ]))
            ->concat($baby->diaperChanges()->orderByDesc('changed_at')->limit($limit)->get()->map(fn ($diaperChange) => [
                'type' => 'diaper_change',
                'at' => $diaperChange->changed_at,
                'data' => $diaperChange,
            ]))
            ->sortByDesc('at')
            ->values()
            ->take($limit);

        return response()->json(['data' => $entries]);
    }
}
