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

        // Accumulated alongside the per-row map below to build the
        // summary stats in the header - real (unrounded) seconds, not the
        // "mm:ss" labels, and long gaps are excluded from the interval
        // average for the same reason they print as "> 60 min" instead of
        // a literal duration: they're a pause between labors on
        // different days, not a real measurement of contraction spacing.
        $durationSeconds = [];
        $intervalSeconds = [];

        $rows = $contractions->map(function ($contraction, $index) use ($contractions, $total, &$durationSeconds, &$intervalSeconds) {
            $startedAt = CarbonImmutable::parse($contraction->started_at);
            $endedAt = $contraction->ended_at ? CarbonImmutable::parse($contraction->ended_at) : null;

            if ($endedAt !== null) {
                $durationSeconds[] = $startedAt->diffInSeconds($endedAt);
            }

            // The next entry in this newest-first list is the *older*
            // neighbor - same reasoning as ContractionTimeline.vue's own
            // `olderNeighbor` (the array's next index, not the previous
            // one, because the list runs newest-to-oldest).
            $olderNeighbor = $contractions->get($index + 1);
            $intervalLabel = null;
            if ($olderNeighbor !== null) {
                $olderEnd = CarbonImmutable::parse($olderNeighbor->ended_at ?? $olderNeighbor->started_at);
                $gapSeconds = (int) $olderEnd->diffInSeconds($startedAt);
                $gapMinutes = intdiv($gapSeconds, 60);
                if ($gapMinutes > self::LONG_GAP_MINUTES) {
                    $intervalLabel = '> '.self::LONG_GAP_MINUTES.' min';
                } else {
                    $intervalLabel = $olderEnd->diff($startedAt)->format('%I:%S');
                    $intervalSeconds[] = $gapSeconds;
                }
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

        $waterBrokeAt = $baby->water_broke_at ? CarbonImmutable::parse($baby->water_broke_at) : null;

        $pdf = Pdf::loadView('pdf.contractions', [
            'groups' => $groups,
            'baby' => $baby,
            'boltOn' => $this->boltDataUri('#a65a6b'),
            'boltOff' => $this->boltDataUri('#e8ddd0'),
            'generatedAt' => CarbonImmutable::now(),
            'totalContractions' => $total,
            'avgDuration' => $durationSeconds ? $this->formatSeconds(array_sum($durationSeconds) / count($durationSeconds)) : null,
            'avgInterval' => $intervalSeconds ? $this->formatSeconds(array_sum($intervalSeconds) / count($intervalSeconds)) : null,
            'waterBrokeAt' => $waterBrokeAt,
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

    /** mm:ss, same format used everywhere else in the export/app. */
    private function formatSeconds(float $totalSeconds): string
    {
        $clamped = max(0, (int) round($totalSeconds));

        return sprintf('%02d:%02d', intdiv($clamped, 60), $clamped % 60);
    }
}
