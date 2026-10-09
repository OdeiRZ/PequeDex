<?php

namespace App\Http\Controllers\Stats;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stats\ExportStatsRequest;
use App\Models\Baby;
use App\Services\Babies\BabyAgeHeadline;
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
            'babyAge' => BabyAgeHeadline::forBaby($baby),
            'generatedAt' => CarbonImmutable::now(),
            'sleep' => $data['sleep'],
            'feed' => $data['feed'],
            'diaper' => $data['diaper'],
            'weekComparison' => $data['week_comparison'] ?? null,
            'sleepTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['sleep_hours']),
            'feedTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['feed_count']),
            'diaperTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['diaper_count']),
            'heatmapGrid' => $this->heatmapGrid($data['activity_heatmap']),
            'heatmapMax' => collect($data['activity_heatmap'])->max('count') ?? 0,
            'vitaminD' => $data['vitamin_d'],
            'dailySleepPoints' => $this->dailySleepPoints($data['weekly_sleep_by_day']),
            'growthMetrics' => [
                ['label' => 'Peso', 'unit' => 'kg', 'decimals' => 1, 'stat' => $data['growth']['weight_kg']],
                ['label' => 'Talla', 'unit' => 'cm', 'decimals' => 0, 'stat' => $data['growth']['height_cm']],
                ['label' => 'Perímetro craneal', 'unit' => 'cm', 'decimals' => 0, 'stat' => $data['growth']['head_circumference_cm']],
            ],
            'hourBucketLabels' => self::HOUR_BUCKET_LABELS,
            'logo' => $this->logoDataUri(),
        ];
    }

    /**
     * dompdf has no flexbox/grid to grow a bar's height like
     * WeeklyTrendChart.vue does on screen - `pdf/partials/
     * weekly-trend-bars.blade.php` draws a HORIZONTAL bar per week
     * instead (a `<div>` with a percentage `width`, which plain CSS2
     * handles fine), one call per metric so each gets its own scale.
     * `$value` stays `null` for a week with no completed sleep (dashed
     * placeholder in the partial, same meaning as the empty-grid mark
     * on screen), never silently turned into a 0.
     *
     * @param  array<int, array{week_start: string, sleep_hours: float|null, feed_count: int, diaper_count: int}>  $weeklyTrend
     * @param  callable(array{week_start: string, sleep_hours: float|null, feed_count: int, diaper_count: int}): (float|int|null)  $value
     * @return array<int, array{label: string, value: float|int|null}>
     */
    private function weeklyTrendPoints(array $weeklyTrend, callable $value): array
    {
        return collect($weeklyTrend)
            ->map(fn (array $week) => [
                'label' => CarbonImmutable::parse($week['week_start'])->translatedFormat('j M'),
                'value' => $value($week),
            ])
            ->all();
    }

    /**
     * "Sueño esta semana" - same shape/partial as weeklyTrendPoints()
     * above (reused in the blade template, `pdf.partials.weekly-trend-
     * bars`), but labeled by weekday ("lun.") instead of a week-start
     * date, and `value` is never null - every one of the 7 calendar
     * days has a real hours figure (possibly 0), unlike a week with no
     * completed sleep.
     *
     * @param  array<int, array{date: string, hours: float}>  $dailySleep
     * @return array<int, array{label: string, value: float}>
     */
    private function dailySleepPoints(array $dailySleep): array
    {
        return collect($dailySleep)
            ->map(fn (array $day) => [
                'label' => CarbonImmutable::parse($day['date'])->translatedFormat('D'),
                'value' => $day['hours'],
            ])
            ->all();
    }

    /**
     * Reshapes the flat `activity_heatmap` list (168 entries, one per
     * day×hour) into a dense 7×24 nested array - `0` where nothing
     * happened, same as `summarizeActivityHeatmap()` already guarantees
     * on the frontend, so the blade partial never has to fill gaps.
     *
     * @param  array<int, array{day_of_week: int, hour: int, count: int}>  $activityHeatmap
     * @return array<int, array<int, int>>
     */
    private function heatmapGrid(array $activityHeatmap): array
    {
        $grid = array_fill(0, 7, array_fill(0, 24, 0));

        foreach ($activityHeatmap as $cell) {
            $grid[$cell['day_of_week']][$cell['hour']] = $cell['count'];
        }

        return $grid;
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
