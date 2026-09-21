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

        $pdf = Pdf::loadView('pdf.contractions', $this->buildViewData($baby));

        return $pdf->stream('contracciones.pdf');
    }

    /**
     * Everything the Blade view needs, split out from show() so the data
     * (grouping, ordering, stats, the water-break entry's position in the
     * timeline) can be tested directly - asserting on the array here is
     * far more reliable than scraping text out of the rendered PDF's
     * compressed content streams, which barryvdh/laravel-dompdf doesn't
     * expose as plain searchable text.
     *
     * @return array<string, mixed>
     */
    public function buildViewData(Baby $baby): array
    {
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
                'type' => 'contraction',
                'sort_at' => $startedAt,
                'number' => $total - $index,
                'started_at' => $startedAt,
                'ended_at' => $endedAt,
                'duration' => $endedAt ? $startedAt->diff($endedAt)->format('%I:%S') : null,
                'intensity' => $contraction->intensity,
                'interval' => $intervalLabel,
            ];
        });

        $waterBrokeAt = $baby->water_broke_at ? CarbonImmutable::parse($baby->water_broke_at) : null;

        // The water-break marker sorts in among the contraction rows by
        // its own timestamp (newest-first, same as everything else) -
        // it's a real event on the same timeline, not a fact that only
        // belongs in a header - instead of a fixed block before the
        // table regardless of when it actually happened.
        $entries = $rows->all();
        if ($waterBrokeAt !== null) {
            $entries[] = [
                'type' => 'water',
                'sort_at' => $waterBrokeAt,
                'at' => $waterBrokeAt,
            ];
        }
        $entries = collect($entries)->sortByDesc('sort_at')->values();

        // Grouped by calendar day for the section headers in the PDF -
        // groups come out newest-day-first too, since $entries is
        // already in that order and groupBy keeps first-seen order.
        $groups = $entries->groupBy(fn ($row) => $row['sort_at']->translatedFormat('d \d\e F \d\e Y'));

        return [
            'groups' => $groups,
            'baby' => $baby,
            'boltOn' => $this->boltDataUri('#a65a6b'),
            'boltOff' => $this->boltDataUri('#e8ddd0'),
            'waterIcon' => $this->waterIconDataUri(),
            'logo' => $this->logoDataUri(),
            'generatedAt' => CarbonImmutable::now(),
            'totalContractions' => $total,
            'avgDuration' => $durationSeconds ? $this->formatSeconds(array_sum($durationSeconds) / count($durationSeconds)) : null,
            'avgInterval' => $intervalSeconds ? $this->formatSeconds(array_sum($intervalSeconds) / count($intervalSeconds)) : null,
        ];
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

    /** Same droplet path as the app's own water-break icon (ContractionsView.vue), in the blue used for the PDF's water-break row. */
    private function waterIconDataUri(): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3f7ea6" stroke-width="2">'
            .'<path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13Z"/></svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    /**
     * The app's favicon (public/favicon.svg) uses a <style> block with a
     * prefers-color-scheme media query and a gradient fill - dompdf
     * doesn't reliably support either inside a data-URI <img> the way it
     * renders the bolt/droplet icons above (plain fill attributes, no
     * <style>/media query), so this rebuilds the same two shapes (sole +
     * heart) with a flat brand-maroon fill instead, for print.
     */
    private function logoDataUri(): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 100">'
            .'<ellipse cx="42" cy="62" rx="26" ry="34" fill="#a65a6b"/>'
            .'<ellipse cx="16" cy="24" rx="7" ry="9" transform="rotate(-10 16 24)" fill="#a65a6b"/>'
            .'<ellipse cx="32" cy="14" rx="7.5" ry="10" transform="rotate(-4 32 14)" fill="#a65a6b"/>'
            .'<ellipse cx="50" cy="12" rx="7.5" ry="10" fill="#a65a6b"/>'
            .'<ellipse cx="66" cy="16" rx="7" ry="9.5" transform="rotate(8 66 16)" fill="#a65a6b"/>'
            .'<path d="M42 54 c-4 -6 -13 -4 -13 3 c0 6 8 11 13 15 c5 -4 13 -9 13 -15 c0 -7 -9 -9 -13 -3 Z" fill="#ffffff"/>'
            .'</svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    /** mm:ss, same format used everywhere else in the export/app. */
    private function formatSeconds(float $totalSeconds): string
    {
        $clamped = max(0, (int) round($totalSeconds));

        return sprintf('%02d:%02d', intdiv($clamped, 60), $clamped % 60);
    }
}
