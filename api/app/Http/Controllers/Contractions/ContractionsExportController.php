<?php

namespace App\Http\Controllers\Contractions;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

class ContractionsExportController extends Controller
{
    /** Gaps longer than this print as "> 60 min" instead of the literal
     * duration: a gap this long is almost never a real measurement,
     * just a pause between labors on different days. An hour is a
     * cleaner, more meaningful cutoff than the reference app's original
     * 50 minutes. */
    private const LONG_GAP_MINUTES = 60;

    public function show(Baby $baby): Response
    {
        $this->authorize('view', $baby);

        // Newest first, same order (and same numbering: the newest
        // contraction gets the highest number, not #1) as the app's own
        // ContractionTimeline.vue - this used to go oldest-first instead,
        // inverted from what the app actually shows.
        $contractions = $baby->contractions()->orderByDesc('started_at')->get()->values();
        $total = $contractions->count();

        $rows = $contractions->map(function ($contraction, $index) use ($contractions, $total) {
            $startedAt = CarbonImmutable::parse($contraction->started_at);
            $endedAt = $contraction->ended_at ? CarbonImmutable::parse($contraction->ended_at) : null;

            // The next entry in this newest-first list is the *older*
            // neighbor - same reasoning as ContractionTimeline.vue's own
            // `olderNeighbor` (the array's next index, not the previous
            // one, because the list runs newest-to-oldest).
            $olderNeighbor = $contractions->get($index + 1);
            $intervalLabel = null;
            if ($olderNeighbor !== null) {
                $olderEnd = CarbonImmutable::parse($olderNeighbor->ended_at ?? $olderNeighbor->started_at);
                $gapMinutes = $olderEnd->diffInMinutes($startedAt);
                $intervalLabel = $gapMinutes > self::LONG_GAP_MINUTES
                    ? '> '.self::LONG_GAP_MINUTES.' min'
                    : $olderEnd->diff($startedAt)->format('%I:%S');
            }

            return [
                'number' => $total - $index,
                'started_at' => $startedAt,
                'ended_at' => $endedAt,
                'duration' => $endedAt ? $startedAt->diff($endedAt)->format('%I:%S') : null,
                'intensity' => $contraction->intensity,
                'interval' => $intervalLabel,
            ];
        });

        // Grouped by calendar day for the section headers in the PDF -
        // groups come out newest-day-first too, since $rows is already
        // in that order and groupBy keeps first-seen order.
        $groups = $rows->groupBy(fn ($row) => $row['started_at']->translatedFormat('d \d\e F \d\e Y'));

        $pdf = Pdf::loadView('pdf.contractions', [
            'groups' => $groups,
            'baby' => $baby,
            'boltOn' => $this->boltDataUri('#a65a6b'),
            'boltOff' => $this->boltDataUri('#e8ddd0'),
        ]);

        return $pdf->stream('contracciones.pdf');
    }

    /**
     * dompdf doesn't render a raw inline <svg> tag (confirmed with an
     * isolated test - nothing shows up), but it does render one given as
     * an <img src="data:image/svg+xml;base64,..."> - so the intensity
     * bolt, same path as the app's own icon, is built as two data URIs
     * (on/off) once per export rather than inline SVG per cell.
     */
    private function boltDataUri(string $color): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="'.$color.'">'
            .'<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
