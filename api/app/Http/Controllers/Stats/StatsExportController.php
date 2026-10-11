<?php

namespace App\Http\Controllers\Stats;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stats\ExportStatsRequest;
use App\Models\Baby;
use App\Services\Babies\BabyAgeHeadline;
use App\Services\Growth\WhoGrowthStandards;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

class StatsExportController extends Controller
{
    /** Mismos rótulos cortos que `stats.hourBucket.*` bajo las barras
     * de HourBucketChart.vue en pantalla. */
    private const HOUR_BUCKET_LABELS = [
        'dawn' => 'Madrugada',
        'morning' => 'Mañana',
        'afternoon' => 'Tarde',
        'night' => 'Noche',
    ];

    /** La pantalla hace scroll horizontal con todas las semanas; en
     * papel no hay scroll, así que se pintan solo las más recientes. */
    private const MAX_TREND_WEEKS = 12;

    private const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    private const PERIOD_LABELS = [
        '7d' => 'Últimos 7 días',
        '30d' => 'Últimos 30 días',
        'all' => 'Todo el historial',
    ];

    /** Mismos tonos que `DIAPER_RESIDUE_COLOR_HEX` en
     * `web/src/lib/diaperResidueColor.ts`; `null` = sin color indicado. */
    private const POOP_COLORS = [
        'amarillo' => ['label' => 'Amarillo', 'hex' => '#E8B93F'],
        'verde' => ['label' => 'Verde', 'hex' => '#5C8A3A'],
        'marron' => ['label' => 'Marrón', 'hex' => '#8B5A2B'],
        'meconio' => ['label' => 'Meconio', 'hex' => '#1C1C1C'],
        'unspecified' => ['label' => 'Sin indicar', 'hex' => null],
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
        $lastPoopAt = $data['diaper']['last_poop_at'] ?? null;

        return [
            'baby' => $baby,
            'babyAge' => BabyAgeHeadline::forBaby($baby),
            'generatedAt' => CarbonImmutable::now(),
            'periodLabel' => self::PERIOD_LABELS[$data['period']],
            'deltaNotes' => $this->deltaNotes($data['period'], $data['period_deltas'] ?? null),
            'sleep' => $data['sleep'],
            'feed' => $data['feed'],
            'diaper' => $data['diaper'],
            'poopColorRows' => $this->poopColorRows($data['diaper']['poop_colors']),
            'lastPoopSince' => $lastPoopAt !== null
                ? CarbonImmutable::parse($lastPoopAt)->locale('es')->diffForHumans()
                : null,
            'weekComparison' => $data['week_comparison'] ?? null,
            'sleepTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['sleep_hours']),
            'longestStretchTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['longest_stretch_minutes'] ?? null),
            'feedTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['feed_count']),
            'diaperTrendPoints' => $this->weeklyTrendPoints($data['weekly_trend'], fn ($w) => $w['diaper_count']),
            'heatmapGrid' => $this->heatmapGrid($data['activity_heatmap']),
            'heatmapMax' => collect($data['activity_heatmap'])->max('count') ?? 0,
            'heatmapSummary' => $this->heatmapSummary($this->heatmapGrid($data['activity_heatmap'])),
            'vitaminD' => $data['vitamin_d'],
            'temperature' => $data['temperature'] ?? null,
            'vaccinations' => $data['vaccinations'] ?? null,
            'dailySleepPoints' => $this->dailySleepPoints($data['weekly_sleep_by_day']),
            'growthMetrics' => [
                $this->growthMetric($baby, 'weight', 'Peso', 'kg', 1, $data['growth']['weight_kg']),
                $this->growthMetric($baby, 'height', 'Talla', 'cm', 0, $data['growth']['height_cm']),
                $this->growthMetric($baby, 'head_circumference', 'Perímetro craneal', 'cm', 0, $data['growth']['head_circumference_cm']),
            ],
            'trendWeeksLimited' => count($data['weekly_trend']) > self::MAX_TREND_WEEKS,
            'hourBucketLabels' => self::HOUR_BUCKET_LABELS,
            'logo' => $this->logoDataUri(),
        ];
    }

    /**
     * Un punto etiquetado por semana para `pdf/partials/vertical-bars`
     * (mismas barras verticales que WeeklyTrendChart.vue), una llamada
     * por métrica para que cada una tenga su propia escala. `$value`
     * sigue `null` en una semana sin sueño completado (marca hueca en el
     * partial, igual que en pantalla), nunca un 0. Solo las
     * `MAX_TREND_WEEKS` más recientes.
     *
     * @param  array<int, array{week_start: string, sleep_hours: float|null, longest_stretch_minutes?: float|null, feed_count: int, diaper_count: int}>  $weeklyTrend
     * @param  callable(array{week_start: string, sleep_hours: float|null, longest_stretch_minutes?: float|null, feed_count: int, diaper_count: int}): (float|int|null)  $value
     * @return array<int, array{label: string, value: float|int|null}>
     */
    private function weeklyTrendPoints(array $weeklyTrend, callable $value): array
    {
        return collect($weeklyTrend)
            ->slice(-self::MAX_TREND_WEEKS)
            ->values()
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
     * La línea pequeña bajo cada ficha con su diferencia frente al
     * periodo anterior ("+25min vs. los 7 días anteriores"), mismo texto
     * que en pantalla. `null` por clave cuando no hay diferencia que
     * mostrar.
     *
     * @param  array<string, float|int|null>|null  $deltas
     * @return array<string, string|null>
     */
    private function deltaNotes(string $period, ?array $deltas): array
    {
        $keys = ['longest_stretch_minutes', 'total_sleep_minutes', 'feeds_per_day', 'pee_per_day', 'poop_per_day'];
        if ($deltas === null || $period === 'all') {
            return array_fill_keys($keys, null);
        }

        $suffix = $period === '30d' ? 'vs. los 30 días anteriores' : 'vs. los 7 días anteriores';
        $minutes = function (float $value) use ($suffix): string {
            $rounded = (int) round($value);
            if ($rounded === 0) {
                return "Sin cambios $suffix";
            }
            $abs = abs($rounded);
            $text = intdiv($abs, 60) > 0 ? intdiv($abs, 60).'h '.($abs % 60).'min' : $abs.'min';

            return ($rounded > 0 ? '+' : '−').$text.' '.$suffix;
        };
        $perDay = fn (float $value): string => abs($value) < 0.05
            ? "Sin cambios $suffix"
            : ($value > 0 ? '+' : '−').number_format(abs($value), 1).' '.$suffix;

        $notes = [];
        foreach ($keys as $key) {
            $value = $deltas[$key] ?? null;
            $notes[$key] = $value === null ? null : (str_ends_with($key, '_minutes') ? $minutes((float) $value) : $perDay((float) $value));
        }

        return $notes;
    }

    /**
     * Solo los colores con al menos un pañal, en el mismo orden que la
     * pantalla.
     *
     * @param  array<string, int>  $counts
     * @return array<int, array{label: string, hex: string|null, count: int}>
     */
    private function poopColorRows(array $counts): array
    {
        return collect(self::POOP_COLORS)
            ->map(fn (array $color, string $key) => [...$color, 'count' => (int) ($counts[$key] ?? 0)])
            ->filter(fn (array $row) => $row['count'] > 0)
            ->values()
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

    /**
     * En pantalla el mapa se lee tocando celdas; en papel no hay
     * interacción, así que el PDF lo acompaña de lo que un cuidador
     * buscaría tocando: el momento de la semana con más actividad, el
     * día más movido, la hora del día más movida y el total. `null` sin
     * ningún evento. Día 0 = lunes, igual que `summarizeActivityHeatmap()`.
     *
     * @param  array<int, array<int, int>>  $grid
     * @return array{total: int, peak: array{day: string, hour: int, count: int}, busiestDay: array{day: string, count: int}, busiestHour: array{hour: int, count: int}}|null
     */
    private function heatmapSummary(array $grid): ?array
    {
        $total = array_sum(array_map('array_sum', $grid));
        if ($total === 0) {
            return null;
        }

        $peak = ['day' => 0, 'hour' => 0, 'count' => -1];
        $hourTotals = array_fill(0, 24, 0);
        foreach ($grid as $day => $hours) {
            foreach ($hours as $hour => $count) {
                $hourTotals[$hour] += $count;
                if ($count > $peak['count']) {
                    $peak = ['day' => $day, 'hour' => $hour, 'count' => $count];
                }
            }
        }

        $dayTotals = array_map('array_sum', $grid);
        $busiestDay = (int) array_search(max($dayTotals), $dayTotals, true);
        $busiestHour = (int) array_search(max($hourTotals), $hourTotals, true);

        return [
            'total' => $total,
            'peak' => ['day' => self::DAY_NAMES[$peak['day']], 'hour' => $peak['hour'], 'count' => $peak['count']],
            'busiestDay' => ['day' => self::DAY_NAMES[$busiestDay], 'count' => $dayTotals[$busiestDay]],
            'busiestHour' => ['hour' => $busiestHour, 'count' => $hourTotals[$busiestHour]],
        ];
    }

    /**
     * @param  array{points: array<int, array{date: string, value: float|int, percentile: float|int|null}>, latest_value: float|int|null, latest_percentile: float|int|null, gained: float|int|null, weekly_rate: float|int|null, count: int}  $stat
     * @return array{label: string, unit: string, decimals: int, stat: array<string, mixed>, chart: string|null, hasReference: bool, firstDate: string|null, lastDate: string|null}
     */
    private function growthMetric(Baby $baby, string $measure, string $label, string $unit, int $decimals, array $stat): array
    {
        $points = $stat['points'];
        $first = $points[0] ?? null;
        $last = $points[count($points) - 1] ?? null;

        $times = array_map(fn ($p) => CarbonImmutable::parse($p['date'])->getTimestamp(), $points);
        $domain = $times === [] ? null : $this->timeDomain(min($times), max($times));
        $bands = $domain === null ? [] : $this->referenceSamples($baby, $measure, $domain[0], $domain[1]);

        // Como en pantalla: con las bandas de la OMS, hasta una sola
        // medición se dibuja (dónde cae frente a la referencia).
        $chart = $domain !== null && (count($points) > 1 || $bands !== [])
            ? $this->growthChartDataUri($points, $times, $domain, $bands)
            : null;

        return [
            'label' => $label,
            'unit' => $unit,
            'decimals' => $decimals,
            'stat' => $stat,
            'chart' => $chart,
            'hasReference' => $chart !== null && $bands !== [],
            'firstDate' => $first ? CarbonImmutable::parse($first['date'])->translatedFormat('j M') : null,
            'lastDate' => $last ? CarbonImmutable::parse($last['date'])->translatedFormat('j M') : null,
        ];
    }

    /**
     * Mismo criterio que GrowthLineChart.vue: con todas las mediciones el
     * mismo día se abre una ventana de ±15 días.
     *
     * @return array{0: int, 1: int}
     */
    private function timeDomain(int $start, int $end): array
    {
        return $start === $end ? [$start - 15 * 86400, $end + 15 * 86400] : [$start, $end];
    }

    /**
     * Las curvas de la OMS (p3/p15/p50/p85/p97) muestreadas en los dos
     * extremos del tramo de fechas y en cada mes entero de por medio -
     * igual que `referenceSamples()` en `web/src/lib/growthReference.ts`.
     * Vacío sin sexo/fecha de nacimiento o fuera de 0-24 meses.
     *
     * @return array<int, array{at: int, p3: float, p15: float, p50: float, p85: float, p97: float}>
     */
    private function referenceSamples(Baby $baby, string $measure, int $start, int $end): array
    {
        if ($baby->sex === null || $baby->birth_date === null) {
            return [];
        }

        $monthSeconds = 30.4375 * 86400;
        $birth = CarbonImmutable::parse($baby->birth_date)->startOfDay()->getTimestamp();
        $fromMonth = max(0, ($start - $birth) / $monthSeconds);
        $toMonth = min(24, ($end - $birth) / $monthSeconds);
        if ($toMonth < $fromMonth) {
            return [];
        }

        $months = [$fromMonth];
        for ($m = (int) floor($fromMonth) + 1; $m < $toMonth; $m++) {
            $months[] = $m;
        }
        if ($toMonth > $fromMonth) {
            $months[] = $toMonth;
        }

        $sex = $baby->sex->whoTableKey();
        $samples = [];
        foreach ($months as $month) {
            $sample = ['at' => (int) round($birth + $month * $monthSeconds)];
            foreach (WhoGrowthStandards::REFERENCE_PERCENTILES as $key => $z) {
                $sample[$key] = (float) WhoGrowthStandards::valueAt($measure, $sex, (float) $month, $z);
            }
            $samples[] = $sample;
        }

        /** @var array<int, array{at: int, p3: float, p15: float, p50: float, p85: float, p97: float}> $samples */
        return $samples;
    }

    /**
     * Misma gráfica de línea que GrowthLineChart.vue (bandas de la OMS
     * detrás si las hay - o el área suave bajo la línea si no -, línea y
     * un punto por medición, el último algo mayor, eje X por fecha real),
     * como SVG en data URI - dompdf pinta SVG en `<img>` igual que el
     * logo. Las fechas van fuera, en HTML, porque el texto dentro del
     * SVG no es fiable en dompdf.
     *
     * @param  array<int, array{date: string, value: float|int, percentile: float|int|null}>  $points
     * @param  array<int, int>  $times
     * @param  array{0: int, 1: int}  $domain
     * @param  array<int, array{at: int, p3: float, p15: float, p50: float, p85: float, p97: float}>  $bands
     */
    private function growthChartDataUri(array $points, array $times, array $domain, array $bands): string
    {
        $width = 600;
        $height = 150;
        $padX = 10;
        $padY = 14;
        $color = '#a65a6b';

        $values = array_map(fn ($p) => (float) $p['value'], $points);
        $scaleValues = [...$values, ...array_column($bands, 'p3'), ...array_column($bands, 'p97')];
        $minV = min($scaleValues);
        $maxV = max($scaleValues) > $minV ? max($scaleValues) : $minV + 1;
        [$startT, $endT] = $domain;

        $x = fn (int $t) => round($padX + ($t - $startT) / ($endT - $startT) * ($width - 2 * $padX), 1);
        $y = fn (float $v) => round($padY + (1 - ($v - $minV) / ($maxV - $minV)) * ($height - 2 * $padY), 1);

        $coords = [];
        foreach ($points as $i => $point) {
            $coords[] = [$x($times[$i]), $y($values[$i])];
        }

        $svgBody = '';
        if (count($bands) >= 2) {
            $band = function (string $upper, string $lower) use ($bands, $x, $y): string {
                $top = array_map(fn ($s) => $x($s['at']).','.$y($s[$upper]), $bands);
                $bottom = array_map(fn ($s) => $x($s['at']).','.$y($s[$lower]), array_reverse($bands));

                return 'M'.implode(' L', [...$top, ...$bottom]).' Z';
            };
            $median = implode(' ', array_map(fn ($s) => $x($s['at']).','.$y($s['p50']), $bands));
            $svgBody .= "<path d=\"{$band('p97', 'p3')}\" fill=\"{$color}\" fill-opacity=\"0.08\"/>"
                ."<path d=\"{$band('p85', 'p15')}\" fill=\"{$color}\" fill-opacity=\"0.12\"/>"
                ."<polyline points=\"{$median}\" fill=\"none\" stroke=\"{$color}\" stroke-opacity=\"0.55\" stroke-width=\"1.5\" stroke-dasharray=\"6 6\"/>";
        } elseif (count($coords) > 1) {
            $floor = $height - $padY;
            $first = $coords[0];
            $last = $coords[count($coords) - 1];
            $svgBody .= "<path d=\"M{$first[0]},{$floor} L".implode(' L', array_map(fn ($c) => "{$c[0]},{$c[1]}", $coords))." L{$last[0]},{$floor} Z\" fill=\"{$color}\" fill-opacity=\"0.12\"/>";
        }

        if (count($coords) > 1) {
            $line = implode(' ', array_map(fn ($c) => "{$c[0]},{$c[1]}", $coords));
            $svgBody .= "<polyline points=\"{$line}\" fill=\"none\" stroke=\"{$color}\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>";
        }

        foreach ($coords as $i => $c) {
            $r = $i === count($coords) - 1 ? 6 : 4.5;
            $svgBody .= "<circle cx=\"{$c[0]}\" cy=\"{$c[1]}\" r=\"{$r}\" fill=\"{$color}\"/>";
        }

        $svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{$width}\" height=\"{$height}\" viewBox=\"0 0 {$width} {$height}\">"
            .$svgBody
            .'</svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
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
