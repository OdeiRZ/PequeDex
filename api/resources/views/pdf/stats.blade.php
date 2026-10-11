<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Estadísticas</title>
    <style>
        /* Calcado de StatsView.vue en pantalla, con las limitaciones de
           dompdf (CSS2, sin flex/grid - tablas en su lugar): fondo crema
           de la app, cada sección es una tarjeta blanca redondeada con la
           franja de color de su categoría junto al título, fichas de 2 en
           2 con el rótulo arriba a la izquierda, gráficas de barras
           verticales y pastillas. Mismo orden de secciones que la
           pantalla. Colores = tokens de web/src/assets/base.css (tema
           claro). */
        @page { margin: 50px 40px 55px; }
        html { background-color: #fbf7f2; }
        body { font-family: sans-serif; font-size: 13px; color: #2b2420; }
        h1 { font-size: 24px; margin: 0 0 12px; color: #2b2420; }

        /* Mismo formato que la tarjeta principal del bebé en el dashboard
           (DashboardView.vue): nombre + sexo arriba, edad en grande +
           fecha de nacimiento debajo, sobre un degradado de marca con un
           par de círculos decorativos traslúcidos. */
        table.baby-card { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        table.baby-card td { background-color: #a65a6b; background-image: linear-gradient(135deg, #a65a6b 0%, #2f6e68 140%); color: #ffffff; padding: 0; border-radius: 20px; }
        .baby-card-wrap { position: relative; padding: 24px 28px; }
        .baby-card-deco-1 { position: absolute; top: -56px; right: -40px; width: 120px; height: 120px; border-radius: 60px; background: rgba(255,255,255,0.14); }
        .baby-card-deco-2 { position: absolute; bottom: -30px; left: 100px; width: 56px; height: 56px; border-radius: 28px; background: rgba(255,255,255,0.1); }
        table.baby-card-inner { position: relative; width: 100%; border-collapse: collapse; }
        table.baby-card-inner td { background: none; padding: 0; color: #ffffff; }
        .baby-card-name { font-size: 16px; font-weight: bold; letter-spacing: 0.3px; }
        .baby-card-sex { font-size: 13px; font-weight: bold; background: rgba(255,255,255,0.22); border-radius: 12px; padding: 5px 14px; }
        .baby-card-age { font-size: 44px; font-weight: bold; line-height: 1; }
        .baby-card-age span { font-size: 19px; font-weight: bold; }
        .baby-card-born { font-size: 13px; opacity: 0.95; }

        .header { position: fixed; top: -32px; left: 0; right: 0; text-align: right; font-size: 9px; color: #a3968a; }
        .footer { position: fixed; bottom: -38px; left: 0; right: 0; text-align: center; font-size: 9px; color: #a3968a; border-top: 1px solid #e8ddd0; padding-top: 6px; }
        .footer img { vertical-align: middle; margin-right: 5px; width: 13px; height: 16px; }

        /* El selector de periodo de la pantalla ("7 días / 30 días /
           Todo"), en papel solo el elegido. */
        .period { text-align: center; margin: 0 0 12px; }
        .period .chip { display: inline-block; background: #ffffff; color: #a65a6b; font-weight: bold; font-size: 11px; border-radius: 10px; padding: 5px 16px; border: 1px solid #efe6dc; }
        .period-hint { display: block; font-size: 9px; color: #7a6f66; margin-top: 4px; }

        /* .card de base.css: blanco, radio 1rem. Padding horizontal de 8px
           + border-spacing de 8px en las tablas internas = 16px de margen
           visual, el `p-4` de la pantalla. */
        .card { background: #ffffff; border: 1px solid #efe6dc; border-radius: 16px; padding: 12px 8px 8px; margin: 0 0 14px; }
        .card-title { font-size: 14px; font-weight: bold; margin: 2px 8px 8px; }
        .card-title .bar { display: inline-block; width: 5px; height: 14px; border-radius: 3px; margin-right: 7px; vertical-align: -2px; }
        .card-subtitle { font-size: 10px; color: #7a6f66; margin: -4px 8px 8px; }
        .sub-label { font-size: 10px; color: #7a6f66; margin: 8px 8px 4px; }
        .empty { color: #7a6f66; font-size: 12px; text-align: center; margin: 6px 8px 10px; }
        .hint { font-size: 9px; color: #7a6f66; margin: 0 8px 6px; }
        .pad { padding: 0 8px; }

        table.tiles { width: 100%; border-collapse: separate; border-spacing: 8px 8px; margin: -8px 0 0; }
        table.tiles td { background: #f3ece4; border-radius: 12px; padding: 9px 11px; text-align: left; vertical-align: top; }
        table.tiles td.tile-empty { background: none; }
        .tile-label { display: block; font-size: 10px; color: #7a6f66; margin-bottom: 3px; }
        .tile-value { display: block; font-size: 16px; font-weight: bold; color: #2b2420; }
        .tile-note { display: block; font-size: 9px; color: #7a6f66; margin-top: 1px; }

        /* Fila hundida "rótulo a la izquierda, cifra a la derecha" - el
           récord de sueño y la última caca en pantalla. */
        table.row { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 4px 0 8px; }
        table.row td.row-cell { background: #f3ece4; border-radius: 12px; padding: 10px 11px; }

        .pill { display: inline-block; background: #f3ece4; border-radius: 12px; padding: 4px 10px; margin: 0 5px 5px 0; font-size: 10px; font-weight: bold; }
        .pill .muted { color: #7a6f66; font-weight: normal; }
        .pill .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 3px; }
    </style>
</head>
<body>
    @php
        $fmtMin = function ($minutes) {
            $rounded = (int) round($minutes);
            $hours = intdiv($rounded, 60);

            return $hours > 0 ? $hours.'h '.($rounded % 60).'min' : ($rounded % 60).'min';
        };
        $fmtDelta = fn ($delta, $decimals = 0) => (abs($delta) < 0.05 ? '' : ($delta > 0 ? '+' : '')).number_format(abs($delta) < 0.05 ? 0 : $delta, $decimals);
        $bucketPoints = fn ($buckets) => array_map(fn ($b) => ['label' => $hourBucketLabels[$b['key']], 'value' => $b['value']], $buckets);
        $sizeLabels = ['0' => 'Talla 0', '1' => 'Talla 1', '2' => 'Talla 2', '3' => 'Talla 3', '4' => 'Talla 4', '5' => 'Talla 5', '6+' => 'Talla 6+', 'unspecified' => 'Sin indicar'];
        $colors = ['feed' => '#c98a3e', 'sleep' => '#5b5a8c', 'diaper' => '#6e9080', 'growth' => '#a65a6b', 'warning' => '#b8742e', 'teal' => '#2f6e68'];
    @endphp

    <div class="header">Generado el {{ $generatedAt->translatedFormat('j \d\e F \d\e Y, H:i') }}</div>
    <h1>Estadísticas</h1>

    <table class="baby-card">
        <tr>
            <td>
                <div class="baby-card-wrap">
                    <span class="baby-card-deco-1"></span>
                    <span class="baby-card-deco-2"></span>
                    <table class="baby-card-inner">
                        <tr>
                            <td style="text-align: left;">
                                <span class="baby-card-name">{{ $baby->name ?: 'Bebé' }}</span>
                            </td>
                            <td style="text-align: right; width: 38%;">
                                @if ($baby->sex?->value === 'nino')
                                    <span class="baby-card-sex">Niño</span>
                                @elseif ($baby->sex?->value === 'nina')
                                    <span class="baby-card-sex">Niña</span>
                                @endif
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: left; padding-top: 10px;">
                                <span class="baby-card-age">{{ $babyAge['value'] }} <span>{{ $babyAge['unit'] }}</span></span>
                            </td>
                            <td style="text-align: right; width: 38%; vertical-align: bottom;">
                                <span class="baby-card-born">Nació el {{ \Carbon\CarbonImmutable::parse($baby->birth_date)->translatedFormat('j \d\e F \d\e Y') }}</span>
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <div class="period">
        <span class="chip">{{ $periodLabel }}</span>
        <span class="period-hint">Se aplica a tomas, sueño y pañales.</span>
    </div>

    {{-- Tomas --}}
    <div class="card">
        <div class="card-title"><span class="bar" style="background: {{ $colors['feed'] }};"></span>Tomas</div>
        @if (! $feed['has_enough_data'])
            <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
        @else
            @include('pdf.partials.tiles', ['tiles' => [
                ['label' => 'Al pecho', 'value' => ($feed['total'] > 0 ? round($feed['by_type']['pecho'] / $feed['total'] * 100) : 0).'%'],
                ['label' => 'Con biberón', 'value' => ($feed['total'] > 0 ? round($feed['by_type']['biberon'] / $feed['total'] * 100) : 0).'%'],
                ['label' => 'Duración media (pecho)', 'value' => $feed['average_pecho_duration_minutes'] !== null ? $fmtMin($feed['average_pecho_duration_minutes']) : null],
                ['label' => 'Cantidad media (biberón)', 'value' => $feed['average_bottle_amount_ml'] !== null ? round($feed['average_bottle_amount_ml']).' ml' : null],
                ['label' => 'Cada cuánto come', 'value' => $feed['average_gap_minutes'] !== null ? $fmtMin($feed['average_gap_minutes']) : null],
                ['label' => 'Tomas al día', 'value' => $feed['average_per_day'] !== null ? number_format($feed['average_per_day'], 1) : null, 'note' => $deltaNotes['feeds_per_day']],
                ['label' => 'Regularidad del horario', 'value' => $feed['gap_std_dev_minutes'] !== null ? ($feed['gap_std_dev_minutes'] < 30 ? 'Muy regular' : ($feed['gap_std_dev_minutes'] < 60 ? 'Regular' : 'Variable')) : null],
            ]])

            @if ($feed['by_type']['pecho'] > 0)
                <table class="tiles">
                    <tr>
                        <td style="padding: 8px 11px; font-size: 10px; color: #7a6f66;">
                            Izquierdo <b style="color: #2b2420;">{{ $feed['pecho_side_counts']['izquierdo'] }}</b>
                            &nbsp;&nbsp;·&nbsp;&nbsp; Derecho <b style="color: #2b2420;">{{ $feed['pecho_side_counts']['derecho'] }}</b>
                            &nbsp;&nbsp;·&nbsp;&nbsp; Ambos <b style="color: #2b2420;">{{ $feed['pecho_side_counts']['ambos'] }}</b>
                        </td>
                    </tr>
                </table>
            @endif

            <div style="page-break-inside: avoid;">
                <p class="sub-label">Tomas por franja</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $bucketPoints($feed['by_hour_bucket']),
                    'color' => $colors['feed'],
                    'format' => fn ($value) => (string) (int) round($value),
                ])
            </div>
        @endif
    </div>

    {{-- Sueño --}}
    <div class="card">
        <div class="card-title"><span class="bar" style="background: {{ $colors['sleep'] }};"></span>Sueño</div>
        @if (! $sleep['has_enough_data'])
            <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
        @else
            @include('pdf.partials.tiles', ['tiles' => [
                ['label' => 'Tramo más largo (media)', 'value' => $sleep['average_longest_stretch_minutes'] !== null ? $fmtMin($sleep['average_longest_stretch_minutes']) : null, 'note' => $deltaNotes['longest_stretch_minutes']],
                ['label' => 'Sueños al día', 'value' => $sleep['average_sleeps_per_day'] !== null ? number_format($sleep['average_sleeps_per_day'], 1) : null],
                ['label' => 'Duración media', 'value' => $fmtMin($sleep['average_duration_minutes'] ?? 0)],
                ['label' => 'Tiempo despierto entre sueños', 'value' => $sleep['average_wake_window_minutes'] !== null ? $fmtMin($sleep['average_wake_window_minutes']) : null],
            ]])

            {{-- Reparto día/noche: la misma barra partida que en pantalla. --}}
            @if ($sleep['average_total_sleep_minutes'] !== null)
                @php
                    $nightShare = $sleep['average_total_sleep_minutes'] > 0
                        ? max(0, min(100, round($sleep['average_night_sleep_minutes'] / $sleep['average_total_sleep_minutes'] * 100)))
                        : 0;
                @endphp
                <table class="tiles">
                    <tr>
                        <td>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 0; font-size: 10px; color: #7a6f66;">Reparto día/noche</td>
                                    <td style="padding: 0; text-align: right; font-size: 13px; font-weight: bold;">{{ $fmtMin($sleep['average_total_sleep_minutes']) }} <span style="font-weight: normal; color: #7a6f66; font-size: 10px;">al día</span></td>
                                </tr>
                            </table>
                            <table style="width: 100%; border-collapse: collapse; margin: 6px 0;">
                                <tr>
                                    @if ($nightShare > 0)
                                        <td style="width: {{ $nightShare }}%; height: 9px; padding: 0; background: {{ $colors['sleep'] }}; border-radius: {{ $nightShare < 100 ? '5px 0 0 5px' : '5px' }};"></td>
                                    @endif
                                    @if ($nightShare < 100)
                                        <td style="height: 9px; padding: 0; background: #c5c4db; border-radius: {{ $nightShare > 0 ? '0 5px 5px 0' : '5px' }};"></td>
                                    @endif
                                </tr>
                            </table>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 0; font-size: 10px; color: #7a6f66;">Noche · {{ $fmtMin($sleep['average_night_sleep_minutes'] ?? 0) }}</td>
                                    <td style="padding: 0; text-align: right; font-size: 10px; color: #7a6f66;">De día · {{ $fmtMin($sleep['average_day_sleep_minutes'] ?? 0) }}</td>
                                </tr>
                            </table>
                            <span style="display: block; font-size: 8px; color: #7a6f66; margin-top: 3px;">Noche: de 20:00 a 08:00</span>
                            @if ($deltaNotes['total_sleep_minutes'] !== null)
                                <span style="display: block; font-size: 9px; color: #7a6f66; margin-top: 1px;">Total al día: {{ $deltaNotes['total_sleep_minutes'] }}</span>
                            @endif
                        </td>
                    </tr>
                </table>
            @endif
        @endif

        {{-- Siempre los últimos 7 días de calendario, haya o no datos
             suficientes para el resto (un día sin sueño es un dato). --}}
        <div style="page-break-inside: avoid;">
            <p class="sub-label">Sueño esta semana</p>
            @include('pdf.partials.vertical-bars', [
                'points' => $dailySleepPoints,
                'color' => $colors['sleep'],
                'format' => fn ($value) => number_format($value, 1).' h',
                'highlightLast' => true,
            ])
        </div>

        @if ($sleep['has_enough_data'])
            <div style="page-break-inside: avoid;">
                <p class="sub-label">Minutos dormidos por franja</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $bucketPoints($sleep['by_hour_bucket']),
                    'color' => $colors['sleep'],
                    'format' => $fmtMin,
                ])
            </div>
        @endif

        @if ($sleep['longest_sleep'] !== null)
            <table class="row">
                <tr>
                    <td class="row-cell">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0; font-size: 10px; color: #7a6f66;">Sueño más largo del periodo<br>{{ \Carbon\CarbonImmutable::parse($sleep['longest_sleep']['date'])->translatedFormat('j \d\e F') }}</td>
                                <td style="padding: 0; text-align: right; font-size: 16px; font-weight: bold; color: {{ $colors['sleep'] }};">{{ $fmtMin($sleep['longest_sleep']['minutes']) }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        @endif
    </div>

    {{-- Pañales --}}
    <div class="card">
        <div class="card-title"><span class="bar" style="background: {{ $colors['diaper'] }};"></span>Pañales</div>
        @if (! $diaper['has_enough_data'])
            <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
        @else
            @include('pdf.partials.tiles', ['tiles' => [
                ['label' => 'Con pis al día', 'value' => $diaper['average_pee_per_day'] !== null ? number_format($diaper['average_pee_per_day'], 1) : null, 'note' => $deltaNotes['pee_per_day']],
                ['label' => 'Con caca al día', 'value' => $diaper['average_poop_per_day'] !== null ? number_format($diaper['average_poop_per_day'], 1) : null, 'note' => $deltaNotes['poop_per_day']],
                ['label' => 'Cambios al día', 'value' => $diaper['average_per_day'] !== null ? number_format($diaper['average_per_day'], 1) : null],
                ['label' => 'Cada cuánto se cambia', 'value' => ($diaper['average_gap_minutes'] ?? null) !== null ? $fmtMin($diaper['average_gap_minutes']) : null],
            ]])

            @if (count($poopColorRows) > 0)
                <p class="sub-label">Color de las cacas</p>
                <div class="pad">
                    @foreach ($poopColorRows as $row)
                        <span class="pill">@if ($row['hex'])<span class="dot" style="background: {{ $row['hex'] }};"></span>@endif{{ $row['label'] }} <span class="muted">· {{ $row['count'] }}</span></span>
                    @endforeach
                </div>
            @endif

            @if (collect($diaper['by_size'])->sum() > 0)
                <p class="sub-label">Por talla</p>
                <div class="pad">
                    @foreach ($diaper['by_size'] as $size => $count)
                        @if ($count > 0)
                            <span class="pill">{{ $sizeLabels[$size] ?? $size }} <span class="muted">· {{ $count }}</span></span>
                        @endif
                    @endforeach
                </div>
            @endif

            <div style="page-break-inside: avoid;">
                <p class="sub-label">Cambios por franja</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $bucketPoints($diaper['by_hour_bucket']),
                    'color' => $colors['diaper'],
                    'format' => fn ($value) => (string) (int) round($value),
                ])
            </div>
        @endif

        @if ($lastPoopSince !== null)
            <table class="row">
                <tr>
                    <td class="row-cell">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0; font-size: 10px; color: #7a6f66;">Última caca</td>
                                <td style="padding: 0; text-align: right; font-size: 16px; font-weight: bold; color: {{ $colors['diaper'] }};">{{ $lastPoopSince }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        @endif
    </div>

    {{-- Temperatura - solo si el bebé tiene alguna medición registrada. --}}
    @if ($temperature !== null)
        @php
            $fmtCelsius = fn ($c) => number_format($c, 1, ',', '').' °C';
            $fmtWhen = fn ($at) => \Carbon\CarbonImmutable::parse($at)->translatedFormat('j M, H:i');
        @endphp
        <div class="card" style="page-break-inside: avoid;">
            <div class="card-title"><span class="bar" style="background: #c0603f;"></span>Temperatura</div>
            @if ($temperature['count'] === 0)
                <p class="empty">Sin mediciones en este periodo.</p>
            @else
                @include('pdf.partials.tiles', ['tiles' => [
                    ['label' => 'Mediciones', 'value' => (string) $temperature['count']],
                    ['label' => 'De 38 °C o más', 'value' => (string) $temperature['high_count']],
                    ['label' => 'Máxima', 'value' => $temperature['max'] !== null ? $fmtCelsius($temperature['max']['celsius']) : null, 'note' => $temperature['max'] !== null ? $fmtWhen($temperature['max']['at']) : null, 'color' => '#c0603f'],
                    ['label' => 'Última', 'value' => $temperature['latest'] !== null ? $fmtCelsius($temperature['latest']['celsius']) : null, 'note' => $temperature['latest'] !== null ? $fmtWhen($temperature['latest']['at']) : null],
                ]])
            @endif
        </div>
    @endif

    {{-- Vitamina D - solo si hay (o hubo) una pauta activada. --}}
    @if ($vitaminD['has_schedule'])
        <div class="card" style="page-break-inside: avoid;">
            <div class="card-title"><span class="bar" style="background: {{ $colors['warning'] }};"></span>Vitamina D</div>
            @include('pdf.partials.tiles', ['columns' => 1, 'tiles' => [
                ['label' => 'Tomas dadas', 'value' => $vitaminD['given'].'/'.$vitaminD['total_days']],
            ]])
        </div>
    @endif

    {{-- Crecimiento - misma gráfica de línea que GrowthLineChart.vue. --}}
    <div class="card" style="page-break-inside: avoid;">
        <div class="card-title"><span class="bar" style="background: {{ $colors['growth'] }};"></span>Crecimiento</div>
        @php
            $hasAnyGrowth = collect($growthMetrics)->contains(fn ($m) => $m['stat']['count'] > 0);
        @endphp
        @if (! $hasAnyGrowth)
            <p class="empty">Todavía no hay medidas de crecimiento registradas.</p>
        @else
            @foreach ($growthMetrics as $metric)
                @if ($metric['stat']['count'] > 0)
                    <div class="pad" style="margin-bottom: 12px; page-break-inside: avoid;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0; font-size: 10px; color: #7a6f66;">{{ $metric['label'] }}</td>
                                <td style="padding: 0; text-align: right; font-size: 10px; font-weight: bold; color: {{ $colors['growth'] }};">
                                    @if ($metric['stat']['latest_percentile'] !== null)
                                        Percentil {{ round($metric['stat']['latest_percentile']) }}
                                    @endif
                                </td>
                            </tr>
                        </table>
                        @if ($metric['chart'] !== null)
                            <img src="{{ $metric['chart'] }}" alt="" style="width: 100%; height: auto; margin-top: 4px;" />
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 0; font-size: 8px; color: #a3968a;">{{ $metric['firstDate'] }}</td>
                                    <td style="padding: 0; font-size: 8px; color: #a3968a; text-align: right;">{{ $metric['lastDate'] }}</td>
                                </tr>
                            </table>
                        @endif
                        <table style="width: 100%; border-collapse: collapse; margin-top: 2px;">
                            <tr>
                                <td style="padding: 0; font-size: 16px; font-weight: bold;">{{ number_format($metric['stat']['latest_value'], $metric['decimals']) }} {{ $metric['unit'] }}</td>
                                <td style="padding: 0; text-align: right; font-size: 10px; font-weight: bold; color: #7a6f66;">
                                    @if ($metric['stat']['gained'] !== null)
                                        {{ $metric['stat']['gained'] > 0 ? '+' : '' }}{{ number_format($metric['stat']['gained'], $metric['decimals']) }} {{ $metric['unit'] }} desde el primer registro
                                    @endif
                                </td>
                            </tr>
                        </table>
                        @if ($metric['stat']['weekly_rate'] !== null)
                            <div style="text-align: right; font-size: 10px; color: #7a6f66;">{{ $metric['stat']['weekly_rate'] > 0 ? '+' : '' }}{{ number_format($metric['stat']['weekly_rate'], $metric['decimals']) }} {{ $metric['unit'] }} por semana</div>
                        @endif
                    </div>
                @endif
            @endforeach
            @if (collect($growthMetrics)->contains(fn ($m) => $m['hasReference']))
                <p class="hint" style="margin-top: -4px;">Bandas de la OMS: la zona clara va del percentil 3 al 97, la más oscura del 15 al 85, y la línea discontinua es la mediana (percentil 50).</p>
            @endif
        @endif
    </div>

    {{-- Tendencia semanal - comparativa arriba (si hay dos semanas
         completas) y una gráfica de barras por métrica, como en pantalla. --}}
    @if (count($sleepTrendPoints) > 0 || $weekComparison !== null)
        <div class="card">
            <div class="card-title"><span class="bar" style="background: {{ $colors['teal'] }};"></span>Tendencia semanal</div>
            @if ($weekComparison !== null)
                @include('pdf.partials.tiles', ['columns' => 3, 'tiles' => [
                    ['label' => 'Sueño', 'value' => $weekComparison['sleep_hours'] !== null ? $fmtDelta($weekComparison['sleep_hours']['delta'], 1).' h' : null, 'color' => ($weekComparison['sleep_hours']['delta'] ?? -1) >= 0 ? $colors['sleep'] : '#7a6f66'],
                    ['label' => 'Tomas', 'value' => $fmtDelta($weekComparison['feed_count']['delta']), 'color' => $weekComparison['feed_count']['delta'] >= 0 ? $colors['feed'] : '#7a6f66'],
                    ['label' => 'Pañales', 'value' => $fmtDelta($weekComparison['diaper_count']['delta']), 'color' => $weekComparison['diaper_count']['delta'] >= 0 ? $colors['diaper'] : '#7a6f66'],
                ]])
                <p class="hint">Esta semana frente a la anterior</p>
            @endif

            @if (count($sleepTrendPoints) > 0)
                @if ($trendWeeksLimited)
                    <p class="hint">Últimas 12 semanas</p>
                @endif
                <div style="page-break-inside: avoid;">
                <p class="sub-label">Sueño (horas/semana)</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $sleepTrendPoints,
                    'color' => $colors['sleep'],
                    'format' => fn ($value) => round($value).'h',
                    'height' => 54,
                ])
                </div>
                <div style="page-break-inside: avoid;">
                <p class="sub-label">Tramo más largo (media de cada semana)</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $longestStretchTrendPoints,
                    'color' => $colors['sleep'],
                    'format' => $fmtMin,
                    'height' => 54,
                ])
                </div>
                <div style="page-break-inside: avoid;">
                <p class="sub-label">Tomas/semana</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $feedTrendPoints,
                    'color' => $colors['feed'],
                    'format' => fn ($value) => (string) (int) round($value),
                    'height' => 54,
                ])
                </div>
                <div style="page-break-inside: avoid;">
                <p class="sub-label">Pañales/semana</p>
                @include('pdf.partials.vertical-bars', [
                    'points' => $diaperTrendPoints,
                    'color' => $colors['diaper'],
                    'format' => fn ($value) => (string) (int) round($value),
                    'height' => 54,
                ])
                </div>
            @endif
        </div>
    @endif

    {{-- Mapa de actividad - lo último, como en pantalla. En papel no se
         pueden tocar las celdas, así que lleva resumen, números y leyenda. --}}
    @if ($heatmapMax > 0)
        <div class="card" style="page-break-inside: avoid;">
            <div class="card-title"><span class="bar" style="background: {{ $colors['teal'] }};"></span>Mapa de actividad</div>
            <p class="card-subtitle">Cuándo suele haber más tomas, cambios de pañal y sueño a lo largo de la semana, sumando todo el historial. Cada casilla indica el número de eventos; cuanto más oscura, más actividad.</p>
            @if ($heatmapSummary !== null)
                @include('pdf.partials.tiles', ['tiles' => [
                    ['label' => 'Momento más activo', 'value' => $heatmapSummary['peak']['day'].', '.sprintf('%02d:00', $heatmapSummary['peak']['hour']), 'note' => $heatmapSummary['peak']['count'].' eventos'],
                    ['label' => 'Día más activo', 'value' => $heatmapSummary['busiestDay']['day'], 'note' => $heatmapSummary['busiestDay']['count'].' eventos'],
                    ['label' => 'Hora más activa', 'value' => sprintf('%02d:00-%02d:00', $heatmapSummary['busiestHour']['hour'], ($heatmapSummary['busiestHour']['hour'] + 1) % 24), 'note' => $heatmapSummary['busiestHour']['count'].' eventos'],
                    ['label' => 'Eventos en total', 'value' => (string) $heatmapSummary['total']],
                ]])
            @endif
            <div class="pad">
                @include('pdf.partials.activity-heatmap-grid', [
                    'heatmapGrid' => $heatmapGrid,
                    'heatmapMax' => $heatmapMax,
                ])
            </div>
        </div>
    @endif

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Estadísticas</div>
</body>
</html>
