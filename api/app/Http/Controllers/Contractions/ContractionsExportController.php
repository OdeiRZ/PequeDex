<?php

namespace App\Http\Controllers\Contractions;

use App\Http\Controllers\Controller;
use App\Models\Baby;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

class ContractionsExportController extends Controller
{
    /** Gaps longer than this print as "> 50 min" instead of the literal
     * duration - same threshold and reasoning as the reference app this
     * feature is modeled on: a gap this long is almost never a real
     * measurement, just a pause between labors on different days. */
    private const LONG_GAP_MINUTES = 50;

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

        $pdf = Pdf::loadView('pdf.contractions', ['groups' => $groups, 'baby' => $baby]);

        return $pdf->stream('contracciones.pdf');
    }
}
