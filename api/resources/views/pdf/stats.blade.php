<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Estadísticas</title>
    <style>
        /* Mismo criterio que pdf/contractions.blade.php - CSS plano, sin
           flex/grid, mismos colores/formas que la propia app en pantalla
           (franja de color por categoría junto al título de cada
           sección, pastillas de cifra tipo "stats-bar"). */
        body { font-family: sans-serif; font-size: 14px; color: #2b2420; }
        h1 { font-size: 26px; margin-bottom: 14px; color: #1a1a1a; }

        /* Mismo formato que la tarjeta principal del bebé en el dashboard
           (DashboardView.vue): nombre + sexo arriba, edad en grande +
           fecha de nacimiento debajo, sobre un degradado de marca con un
           par de círculos decorativos traslúcidos - mismo truco que la
           propia tarjeta en pantalla (dos `span` con `rounded-full` y
           opacidad baja). El bug real de antes (la tarjeta entera no
           aparecía) era el selector `>` de un commit anterior, no el
           degradado en sí - confirmado con una captura real del PDF
           (Ghostscript, `gswin64c -sDEVICE=png16m`, única forma de verlo
           sin desplegar). */
        table.baby-card { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        table.baby-card td { background-color: #a65a6b; background-image: linear-gradient(135deg, #a65a6b 0%, #2f6e68 140%); color: #ffffff; padding: 0; border-radius: 20px; }
        .baby-card-wrap { position: relative; padding: 26px 30px; }
        .baby-card-deco-1 { position: absolute; top: -56px; right: -40px; width: 120px; height: 120px; border-radius: 60px; background: rgba(255,255,255,0.14); }
        .baby-card-deco-2 { position: absolute; bottom: -30px; left: 100px; width: 56px; height: 56px; border-radius: 28px; background: rgba(255,255,255,0.1); }
        table.baby-card-inner { position: relative; width: 100%; border-collapse: collapse; }
        table.baby-card-inner td { background: none; padding: 0; color: #ffffff; }
        .baby-card-name { font-size: 16px; font-weight: bold; letter-spacing: 0.3px; }
        .baby-card-sex { font-size: 13px; font-weight: bold; background: rgba(255,255,255,0.22); border-radius: 12px; padding: 5px 14px; }
        .baby-card-age { font-size: 46px; font-weight: bold; line-height: 1; }
        .baby-card-age span { font-size: 19px; font-weight: bold; }
        .baby-card-born { font-size: 14px; opacity: 0.95; }

        /* Fija en la parte superior de CADA página, igual que .footer ya
           hace en la inferior - no solo debajo del título en la primera. */
        .header { position: fixed; top: -30px; left: 0; right: 0; text-align: right; font-size: 10px; color: #a3968a; }

        h2 { font-size: 17px; margin: 22px 0 10px; padding-left: 10px; border-left: 5px solid #a3968a; }
        h2.feed { border-left-color: #c98a3e; }
        h2.sleep { border-left-color: #5b5a8c; }
        h2.diaper { border-left-color: #6e9080; }
        h2.growth { border-left-color: #a65a6b; }
        h2.trend { border-left-color: #2f6e68; }
        h2.vitamind { border-left-color: #b8742e; }

        .empty { color: #a3968a; font-style: italic; margin: 0 0 10px; }

        table.stats-bar { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 12px -8px; }
        table.stats-bar td { background: #f3ece4; border-radius: 8px; padding: 10px 14px; text-align: center; }
        .stats-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; margin-bottom: 4px; }
        .stats-value { display: block; font-size: 17px; font-weight: bold; color: #2b2420; }

        /* Las 4 franjas horarias (Madrugada/Mañana/Tarde/Noche) ocupaban
           4 filas a todo lo ancho con la mayor parte del espacio vacío -
           2 por fila en vez de 1, mismo estilo de ficha que .stats-bar. */
        table.bucket-grid { width: 100%; border-collapse: separate; border-spacing: 8px 8px; margin: 0 0 14px -8px; }
        table.bucket-grid td { width: 50%; background: #f3ece4; border-radius: 8px; padding: 8px 12px; text-align: center; }

        .stats-note { display: block; font-size: 10px; color: #7a6f66; margin-top: 2px; }

        .size-pill { display: inline-block; background: #f3ece4; border-radius: 10px; padding: 4px 10px; margin: 0 6px 6px 0; font-size: 12px; }
        .size-pill b { color: #2b2420; }

        .footer { position: fixed; bottom: -35px; left: 0; right: 0; text-align: center; font-size: 10px; color: #a3968a; border-top: 1px solid #e8ddd0; padding-top: 6px; }
        .footer img { vertical-align: middle; margin-right: 5px; width: 13px; height: 16px; }
    </style>
</head>
<body>
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

    {{-- Tomas --}}
    <h2 class="feed">Tomas</h2>
    @if (! $feed['has_enough_data'])
        <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
    @else
        <table class="stats-bar">
            <tr>
                <td style="width: 25%;">
                    <span class="stats-label">Al pecho</span>
                    <span class="stats-value">{{ $feed['total'] > 0 ? round($feed['by_type']['pecho'] / $feed['total'] * 100) : 0 }}%</span>
                </td>
                <td style="width: 25%;">
                    <span class="stats-label">Con biberón</span>
                    <span class="stats-value">{{ $feed['total'] > 0 ? round($feed['by_type']['biberon'] / $feed['total'] * 100) : 0 }}%</span>
                </td>
                @if ($feed['average_gap_minutes'] !== null)
                    <td style="width: 25%;">
                        <span class="stats-label">Cada cuánto come</span>
                        <span class="stats-value">{{ intdiv((int) round($feed['average_gap_minutes']), 60) }}h {{ (int) round($feed['average_gap_minutes']) % 60 }}min</span>
                    </td>
                @endif
                @if ($feed['average_per_day'] !== null)
                    <td style="width: 25%;">
                        <span class="stats-label">Tomas al día</span>
                        <span class="stats-value">{{ number_format($feed['average_per_day'], 1) }}</span>
                    </td>
                @endif
            </tr>
        </table>

        @if ($feed['average_pecho_duration_minutes'] !== null || $feed['average_bottle_amount_ml'] !== null)
            <table class="stats-bar">
                <tr>
                    @if ($feed['average_pecho_duration_minutes'] !== null)
                        <td style="width: 50%;">
                            <span class="stats-label">Duración media (pecho)</span>
                            <span class="stats-value">{{ (int) round($feed['average_pecho_duration_minutes']) }} min</span>
                        </td>
                    @endif
                    @if ($feed['average_bottle_amount_ml'] !== null)
                        <td style="width: 50%;">
                            <span class="stats-label">Cantidad media (biberón)</span>
                            <span class="stats-value">{{ (int) round($feed['average_bottle_amount_ml']) }} ml</span>
                        </td>
                    @endif
                </tr>
            </table>
        @endif

        @if ($feed['gap_std_dev_minutes'] !== null)
            @php
                $feedRegularity = $feed['gap_std_dev_minutes'] < 30 ? 'Muy regular' : ($feed['gap_std_dev_minutes'] < 60 ? 'Regular' : 'Variable');
            @endphp
            <table class="stats-bar">
                <tr>
                    <td>
                        <span class="stats-label">Regularidad del horario</span>
                        <span class="stats-value">{{ $feedRegularity }}</span>
                    </td>
                </tr>
            </table>
        @endif

        @include('pdf.partials.bucket-grid', [
            'buckets' => $feed['by_hour_bucket'],
            'labels' => $hourBucketLabels,
            'format' => fn ($value) => (int) round($value).' tomas',
        ])
    @endif

    {{-- Sueño --}}
    <h2 class="sleep">Sueño</h2>
    @if (! $sleep['has_enough_data'])
        <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
    @else
        <table class="stats-bar">
            <tr>
                <td style="width: 33%;">
                    <span class="stats-label">Sueños registrados</span>
                    <span class="stats-value">{{ $sleep['total_completed'] }}</span>
                </td>
                <td style="width: 33%;">
                    <span class="stats-label">Duración media</span>
                    <span class="stats-value">{{ intdiv((int) round($sleep['average_duration_minutes']), 60) }}h {{ (int) round($sleep['average_duration_minutes']) % 60 }}min</span>
                </td>
                @if ($sleep['average_wake_window_minutes'] !== null)
                    <td style="width: 33%;">
                        <span class="stats-label">Despierto entre sueños</span>
                        <span class="stats-value">{{ intdiv((int) round($sleep['average_wake_window_minutes']), 60) }}h {{ (int) round($sleep['average_wake_window_minutes']) % 60 }}min</span>
                    </td>
                @endif
            </tr>
        </table>

        @if ($sleep['typical_bedtime'] !== null || $sleep['typical_wake_time'] !== null)
            <table class="stats-bar">
                <tr>
                    @if ($sleep['typical_bedtime'] !== null)
                        <td style="width: 50%;">
                            <span class="stats-label">Hora habitual de acostarse</span>
                            <span class="stats-value">{{ sprintf('%02d:%02d', $sleep['typical_bedtime']['hours'], $sleep['typical_bedtime']['minutes']) }}</span>
                        </td>
                    @endif
                    @if ($sleep['typical_wake_time'] !== null)
                        <td style="width: 50%;">
                            <span class="stats-label">Hora habitual de despertar</span>
                            <span class="stats-value">{{ sprintf('%02d:%02d', $sleep['typical_wake_time']['hours'], $sleep['typical_wake_time']['minutes']) }}</span>
                        </td>
                    @endif
                </tr>
            </table>
        @endif

        @if ($sleep['average_total_sleep_minutes'] !== null)
            <table class="stats-bar">
                <tr>
                    <td style="width: 33%;">
                        <span class="stats-label">Total al día</span>
                        <span class="stats-value">{{ intdiv((int) round($sleep['average_total_sleep_minutes']), 60) }}h {{ (int) round($sleep['average_total_sleep_minutes']) % 60 }}min</span>
                    </td>
                    <td style="width: 33%;">
                        <span class="stats-label">De noche</span>
                        <span class="stats-value">{{ intdiv((int) round($sleep['average_night_sleep_minutes']), 60) }}h {{ (int) round($sleep['average_night_sleep_minutes']) % 60 }}min</span>
                    </td>
                    <td style="width: 33%;">
                        <span class="stats-label">Siestas</span>
                        <span class="stats-value">{{ intdiv((int) round($sleep['average_nap_minutes']), 60) }}h {{ (int) round($sleep['average_nap_minutes']) % 60 }}min</span>
                    </td>
                </tr>
            </table>
        @endif

        @include('pdf.partials.bucket-grid', [
            'buckets' => $sleep['by_hour_bucket'],
            'labels' => $hourBucketLabels,
            'format' => fn ($value) => intdiv((int) round($value), 60).'h '.((int) round($value) % 60).'min',
        ])
    @endif

    @if ($sleep['longest_sleep'] !== null)
        <table class="stats-bar">
            <tr>
                <td>
                    <span class="stats-label">Sueño más largo registrado</span>
                    <span class="stats-value">
                        {{ intdiv($sleep['longest_sleep']['minutes'], 60) }}h {{ $sleep['longest_sleep']['minutes'] % 60 }}min
                        <span style="font-weight: normal; font-size: 12px; color: #7a6f66;">— {{ \Carbon\CarbonImmutable::parse($sleep['longest_sleep']['date'])->translatedFormat('j \d\e F') }}</span>
                    </span>
                </td>
            </tr>
        </table>
    @endif

    {{-- Pañales --}}
    <h2 class="diaper">Pañales</h2>
    @if (! $diaper['has_enough_data'])
        <p class="empty">Todavía no hay datos suficientes para esta estadística.</p>
    @else
        <table class="stats-bar">
            <tr>
                <td style="width: 25%;">
                    <span class="stats-label">Mojado</span>
                    <span class="stats-value">{{ $diaper['total'] > 0 ? round($diaper['by_type']['mojado'] / $diaper['total'] * 100) : 0 }}%</span>
                </td>
                <td style="width: 25%;">
                    <span class="stats-label">Sucio</span>
                    <span class="stats-value">{{ $diaper['total'] > 0 ? round($diaper['by_type']['sucio'] / $diaper['total'] * 100) : 0 }}%</span>
                </td>
                <td style="width: 25%;">
                    <span class="stats-label">Ambos</span>
                    <span class="stats-value">{{ $diaper['total'] > 0 ? round($diaper['by_type']['ambos'] / $diaper['total'] * 100) : 0 }}%</span>
                </td>
                @if ($diaper['average_per_day'] !== null)
                    <td style="width: 25%;">
                        <span class="stats-label">Cambios al día</span>
                        <span class="stats-value">{{ number_format($diaper['average_per_day'], 1) }}</span>
                    </td>
                @endif
            </tr>
        </table>

        @if ($diaper['average_wet_per_day'] !== null)
            <table class="stats-bar">
                <tr>
                    <td>
                        <span class="stats-label">Mojados al día</span>
                        <span class="stats-value">{{ number_format($diaper['average_wet_per_day'], 1) }}</span>
                    </td>
                </tr>
            </table>
        @endif

        @php
            $sizeLabels = ['0' => 'Talla 0', '1' => 'Talla 1', '2' => 'Talla 2', '3' => 'Talla 3', '4' => 'Talla 4', '5' => 'Talla 5', '6+' => 'Talla 6+', 'unspecified' => 'Sin indicar'];
        @endphp
        @if (collect($diaper['by_size'])->sum() > 0)
            <p style="margin: 0 0 12px;">
                @foreach ($diaper['by_size'] as $size => $count)
                    @if ($count > 0)
                        <span class="size-pill">{{ $sizeLabels[$size] ?? $size }} · <b>{{ $count }}</b></span>
                    @endif
                @endforeach
            </p>
        @endif

        <p class="stats-label" style="margin-bottom: 4px;">Pis por franja</p>
        @include('pdf.partials.bucket-grid', [
            'buckets' => $diaper['pee_by_hour_bucket'],
            'labels' => $hourBucketLabels,
            'format' => fn ($value) => (string) (int) round($value),
        ])

        <p class="stats-label" style="margin-bottom: 4px;">Caca por franja</p>
        @include('pdf.partials.bucket-grid', [
            'buckets' => $diaper['poop_by_hour_bucket'],
            'labels' => $hourBucketLabels,
            'format' => fn ($value) => (string) (int) round($value),
        ])
    @endif

    {{-- Comparativa semanal - última semana completa frente a la anterior
         (ver summarizeWeekComparison() en lib/stats.ts); null con menos de
         dos semanas completas con dato. --}}
    @if ($weekComparison !== null)
        <h2 class="trend">Esta semana frente a la anterior</h2>
        <table class="stats-bar">
            <tr>
                @if ($weekComparison['sleep_hours'] !== null)
                    <td style="width: 33%;">
                        <span class="stats-label">Sueño</span>
                        <span class="stats-value">
                            {{ $weekComparison['sleep_hours']['delta'] > 0 ? '+' : '' }}{{ number_format($weekComparison['sleep_hours']['delta'], 1) }}h
                        </span>
                    </td>
                @endif
                <td style="width: 33%;">
                    <span class="stats-label">Tomas</span>
                    <span class="stats-value">
                        {{ $weekComparison['feed_count']['delta'] > 0 ? '+' : '' }}{{ (int) round($weekComparison['feed_count']['delta']) }}
                    </span>
                </td>
                <td style="width: 33%;">
                    <span class="stats-label">Pañales</span>
                    <span class="stats-value">
                        {{ $weekComparison['diaper_count']['delta'] > 0 ? '+' : '' }}{{ (int) round($weekComparison['diaper_count']['delta']) }}
                    </span>
                </td>
            </tr>
        </table>
    @endif

    {{-- Tendencia semanal - mismos puntos que WeeklyTrendChart.vue,
         dibujados como barra horizontal (ver el partial) en vez de
         vertical, ya que dompdf no tiene flexbox para crecer una
         altura dinámica. --}}
    @if (count($sleepTrendPoints) > 0)
        <h2 class="trend">Tendencia semanal</h2>
        <p class="stats-label" style="margin-bottom: 4px;">Sueño</p>
        @include('pdf.partials.weekly-trend-bars', [
            'points' => $sleepTrendPoints,
            'color' => '#5b5a8c',
            'format' => fn ($value) => number_format($value, 1).'h',
        ])
        <p class="stats-label" style="margin-bottom: 4px;">Tomas</p>
        @include('pdf.partials.weekly-trend-bars', [
            'points' => $feedTrendPoints,
            'color' => '#c98a3e',
            'format' => fn ($value) => (int) round($value),
        ])
        <p class="stats-label" style="margin-bottom: 4px;">Pañales</p>
        @include('pdf.partials.weekly-trend-bars', [
            'points' => $diaperTrendPoints,
            'color' => '#6e9080',
            'format' => fn ($value) => (int) round($value),
        ])
    @endif

    {{-- Mapa de actividad - misma rejilla 7x24 que ActivityHeatmap.vue,
         sin umbral de muestra mínima (igual que en pantalla): toda
         semana con algo de dato ya es información real. --}}
    @if ($heatmapMax > 0)
        <h2 class="trend">Mapa de actividad</h2>
        <p style="margin: 0 0 8px; font-size: 11px; color: #7a6f66;">Cuándo suele haber más tomas, cambios de pañal y sueño a lo largo de la semana.</p>
        @include('pdf.partials.activity-heatmap-grid', [
            'heatmapGrid' => $heatmapGrid,
            'heatmapMax' => $heatmapMax,
        ])
    @endif

    {{-- Vitamina D - no depende de un umbral de muestra, solo de si hay
         (o hubo) una pauta activada para este bebé. --}}
    @if ($vitaminD['has_schedule'])
        <h2 class="vitamind">Vitamina D</h2>
        <table class="stats-bar">
            <tr>
                <td>
                    <span class="stats-label">Tomas dadas</span>
                    <span class="stats-value">{{ $vitaminD['given'] }}/{{ $vitaminD['total_days'] }}</span>
                </td>
            </tr>
        </table>
    @endif

    {{-- Crecimiento --}}
    <h2 class="growth">Crecimiento</h2>
    @php
        $hasAnyGrowth = collect($growthMetrics)->contains(fn ($m) => $m['stat']['count'] > 0);
    @endphp
    @if (! $hasAnyGrowth)
        <p class="empty">Todavía no hay medidas de crecimiento registradas.</p>
    @else
        @foreach ($growthMetrics as $metric)
            @if ($metric['stat']['count'] > 0)
                <p class="stats-label" style="margin-bottom: 4px;">{{ $metric['label'] }}</p>
                @include('pdf.partials.growth-points-grid', [
                    'points' => $metric['stat']['points'],
                    'unit' => $metric['unit'],
                    'decimals' => $metric['decimals'],
                ])
                @if ($metric['stat']['gained'] !== null)
                    <p class="empty" style="font-style: normal; margin-top: -6px;">
                        {{ $metric['stat']['gained'] > 0 ? '+' : '' }}{{ number_format($metric['stat']['gained'], $metric['decimals']) }} {{ $metric['unit'] }} desde el primer registro
                        @if ($metric['stat']['weekly_rate'] !== null)
                            ({{ $metric['stat']['weekly_rate'] > 0 ? '+' : '' }}{{ number_format($metric['stat']['weekly_rate'], $metric['decimals']) }} {{ $metric['unit'] }}/semana)
                        @endif
                    </p>
                @endif
            @endif
        @endforeach
    @endif

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Estadísticas</div>
</body>
</html>
