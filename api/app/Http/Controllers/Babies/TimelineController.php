<?php

namespace App\Http\Controllers\Babies;

use App\Http\Controllers\Concerns\HandlesEtags;
use App\Http\Controllers\Controller;
use App\Models\Baby;
use App\Services\Support\BabyActivityVersion;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    use HandlesEtags;

    /**
     * Merges feeds/sleeps/diaper_changes/temperatures into one chronological list -
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
     *
     * `date` (YYYY-MM-DD) switches to a different mode entirely: every
     * entry that could overlap that single calendar day, not just the
     * most recent $limit overall - without this there was no way to see
     * "Ritmo"/feeds for a day before today once more than $limit things
     * had happened since (or, for a lighter-use baby, simply no way to
     * jump to an older day at all - the default mode only ever looks at
     * "most recent", never "this specific day"). A day's own entries
     * are naturally few, so no $limit is applied in this mode. The
     * range starts a day early to catch a sleep that began the day
     * before and spans into this one - DailyRhythm.vue's own clipping
     * logic on the frontend narrows everything down to the exact
     * [00:00, 24:00) window from there.
     */
    public function index(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        // Sondeo condicional: si nada ha cambiado desde la última respuesta
        // que vio el cliente, se contesta 304 sin leer ni enviar ninguna
        // fila. El Dashboard pregunta cada 15 s y casi siempre es igual.
        $etag = $this->etag($baby, $request);
        if ($etag !== null && $this->etagMatches($request->header('If-None-Match'), $etag)) {
            return response()->json(status: 304)->header('ETag', $etag);
        }

        $response = $this->entries($request, $baby);

        return $etag === null ? $response : $response->header('ETag', $etag);
    }

    /**
     * Huella de lo que alimenta esta lista: número de filas, última
     * modificación y último id de cada tabla del bebé (una sola consulta
     * agregada, ver BabyActivityVersion, en vez de leer las filas). Cambia al crear,
     * editar o borrar cualquier registro; también cambia por registros
     * fuera de las 50 entradas visibles, lo que solo cuesta alguna
     * respuesta completa de más, nunca una de menos.
     */
    private function etag(Baby $baby, Request $request): ?string
    {
        $versions = BabyActivityVersion::for($baby, BabyActivityVersion::TIMELINE);

        // Sin huella (no se pudo calcular): respuesta completa y sin ETag.
        if ($versions === null) {
            return null;
        }

        return '"'.md5((string) json_encode([$request->query('date'), $request->query('limit'), $versions])).'"';
    }

    private function entries(Request $request, Baby $baby): JsonResponse
    {
        $date = $request->query('date');

        if ($date) {
            $dayStart = Carbon::parse($date)->startOfDay();
            $dayEnd = Carbon::parse($date)->endOfDay();
            $rangeStart = $dayStart->copy()->subDay();

            $entries = collect()
                ->concat($baby->feeds()->whereBetween('started_at', [$rangeStart, $dayEnd])->orderByDesc('started_at')->get()->map(fn ($feed) => [
                    'type' => 'feed',
                    'at' => $feed->started_at,
                    'data' => $feed,
                ]))
                ->concat($baby->sleeps()->whereBetween('started_at', [$rangeStart, $dayEnd])->orderByDesc('started_at')->get()->map(fn ($sleep) => [
                    'type' => 'sleep',
                    'at' => $sleep->started_at,
                    'data' => $sleep,
                ]))
                ->concat($baby->diaperChanges()->whereBetween('changed_at', [$rangeStart, $dayEnd])->orderByDesc('changed_at')->get()->map(fn ($diaperChange) => [
                    'type' => 'diaper_change',
                    'at' => $diaperChange->changed_at,
                    'data' => $diaperChange,
                ]))->concat($baby->temperatures()->whereBetween('measured_at', [$rangeStart, $dayEnd])->orderByDesc('measured_at')->get()->map(fn ($temperature) => [
                    'type' => 'temperature',
                    'at' => $temperature->measured_at,
                    'data' => $temperature,
                ]))
                ->sortByDesc('at')
                ->values();

            return response()->json(['data' => $entries]);
        }

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
            ]))->concat($baby->temperatures()->orderByDesc('measured_at')->limit($limit)->get()->map(fn ($temperature) => [
                'type' => 'temperature',
                'at' => $temperature->measured_at,
                'data' => $temperature,
            ]))
            ->sortByDesc('at')
            ->values()
            ->take($limit);

        return response()->json(['data' => $entries]);
    }
}
