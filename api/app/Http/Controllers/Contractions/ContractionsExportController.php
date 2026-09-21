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

        $contractions = $baby->contractions()->orderBy('started_at')->get();

        $rows = [];
        $previousEnd = null;

        foreach ($contractions as $contraction) {
            $startedAt = CarbonImmutable::parse($contraction->started_at);
            $endedAt = $contraction->ended_at ? CarbonImmutable::parse($contraction->ended_at) : null;

            $intervalLabel = null;
            if ($previousEnd !== null) {
                $gapMinutes = $previousEnd->diffInMinutes($startedAt);
                $intervalLabel = $gapMinutes > self::LONG_GAP_MINUTES
                    ? '> '.self::LONG_GAP_MINUTES.' min'
                    : $previousEnd->diff($startedAt)->format('%I:%S');
            }

            $rows[] = [
                'started_at' => $startedAt,
                'ended_at' => $endedAt,
                'duration' => $endedAt ? $startedAt->diff($endedAt)->format('%I:%S') : null,
                'intensity' => $contraction->intensity,
                'interval' => $intervalLabel,
            ];

            $previousEnd = $endedAt ?? $startedAt;
        }

        // Grouped by calendar day for the section headers in the PDF -
        // the interval above is still computed across the whole ordered
        // list beforehand, not reset per group, so the first row of a
        // new day still shows its real gap from the last row of the
        // previous one (same as the reference app's own PDF).
        $groups = collect($rows)->groupBy(fn ($row) => $row['started_at']->translatedFormat('d \d\e F \d\e Y'));

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
