<?php

namespace App\Http\Controllers\Stats;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stats\ExportStatsRequest;
use App\Models\Baby;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

class StatsExportController extends Controller
{
    private const HOUR_BUCKET_LABELS = [
        'dawn' => 'Madrugada (00-06h)',
        'morning' => 'Mañana (06-12h)',
        'afternoon' => 'Tarde (12-18h)',
        'night' => 'Noche (18-24h)',
    ];

    public function store(ExportStatsRequest $request, Baby $baby): Response
    {
        $pdf = Pdf::loadView('pdf.stats', $this->buildViewData($baby, $request->validated()));

        return $pdf->stream('estadisticas.pdf');
    }

    /**
     * Split out from store() so the shaping (hour-bucket labels, growth
     * metric list) can be tested directly against the array, same
     * reasoning as ContractionsExportController::buildViewData().
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function buildViewData(Baby $baby, array $data): array
    {
        return [
            'baby' => $baby,
            'generatedAt' => CarbonImmutable::now(),
            'sleep' => $data['sleep'],
            'feed' => $data['feed'],
            'diaper' => $data['diaper'],
            'growthMetrics' => [
                ['label' => 'Peso', 'unit' => 'kg', 'decimals' => 1, 'stat' => $data['growth']['weight_kg']],
                ['label' => 'Talla', 'unit' => 'cm', 'decimals' => 0, 'stat' => $data['growth']['height_cm']],
                ['label' => 'Perímetro craneal', 'unit' => 'cm', 'decimals' => 0, 'stat' => $data['growth']['head_circumference_cm']],
            ],
            'hourBucketLabels' => self::HOUR_BUCKET_LABELS,
            'logo' => $this->logoDataUri(),
        ];
    }

    /** Same logo as ContractionsExportController - kept in sync by hand
     * (see that class's own docblock on why it's redrawn instead of
     * reusing the app's real favicon.svg). */
    private function logoDataUri(): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 100">'
            .'<path d="M42 28 C58 28 68 40 68 56 C68 70 64 82 57 90'
                .' C53 95 48 97.5 42 98 C36 97.5 31 95 27 90 C20 82 16 70 16 56'
                .' C16 40 26 28 42 28 Z" fill="#a65a6b"/>'
            .'<ellipse cx="16" cy="24" rx="7" ry="9" transform="rotate(-10 16 24)" fill="#a65a6b"/>'
            .'<ellipse cx="32" cy="14" rx="7.5" ry="10" transform="rotate(-4 32 14)" fill="#a65a6b"/>'
            .'<ellipse cx="50" cy="12" rx="7.5" ry="10" fill="#a65a6b"/>'
            .'<ellipse cx="66" cy="16" rx="7" ry="9.5" transform="rotate(8 66 16)" fill="#a65a6b"/>'
            .'<path d="M42 54 c-4 -6 -13 -4 -13 3 c0 6 8 11 13 15 c5 -4 13 -9 13 -15 c0 -7 -9 -9 -13 -3 Z" fill="#ffffff"/>'
            .'</svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
