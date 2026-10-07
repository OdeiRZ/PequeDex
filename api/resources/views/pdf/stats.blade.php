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
        h1 { font-size: 26px; margin-bottom: 2px; color: #1a1a1a; }
        .subtitle { color: #7a6f66; margin-bottom: 4px; font-size: 15px; }
        .meta { color: #a3968a; font-size: 11px; margin-bottom: 18px; }

        h2 { font-size: 17px; margin: 22px 0 10px; padding-left: 10px; border-left: 5px solid #a3968a; }
        h2.feed { border-left-color: #c98a3e; }
        h2.sleep { border-left-color: #5b5a8c; }
        h2.diaper { border-left-color: #6e9080; }
        h2.growth { border-left-color: #a65a6b; }

        .empty { color: #a3968a; font-style: italic; margin: 0 0 10px; }

        table.stats-bar { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 12px -8px; }
        table.stats-bar td { background: #f3ece4; border-radius: 8px; padding: 10px 14px; text-align: center; }
        .stats-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; margin-bottom: 4px; }
        .stats-value { display: block; font-size: 17px; font-weight: bold; color: #2b2420; }

        table.bucket-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; margin-bottom: 14px; }
        table.bucket-table td { background: #f3ece4; padding: 6px 10px; }
        table.bucket-table td:first-child { border-radius: 8px 0 0 8px; color: #7a6f66; }
        table.bucket-table td:last-child { border-radius: 0 8px 8px 0; text-align: right; font-weight: bold; }

        table.growth-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; margin-bottom: 14px; }
        table.growth-table th { text-align: right; padding: 4px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; }
        table.growth-table th:first-child { text-align: left; }
        table.growth-table td { background: #f3ece4; padding: 7px 10px; text-align: right; }
        table.growth-table td:first-child { border-radius: 8px 0 0 8px; text-align: left; color: #7a6f66; }
        table.growth-table td:last-child { border-radius: 0 8px 8px 0; }

        .size-pill { display: inline-block; background: #f3ece4; border-radius: 10px; padding: 4px 10px; margin: 0 6px 6px 0; font-size: 12px; }
        .size-pill b { color: #2b2420; }

        .footer { position: fixed; bottom: -35px; left: 0; right: 0; text-align: center; font-size: 10px; color: #a3968a; border-top: 1px solid #e8ddd0; padding-top: 6px; }
        .footer img { vertical-align: middle; margin-right: 5px; width: 13px; height: 16px; }
    </style>
</head>
<body>
    <h1>Estadísticas</h1>
    <p class="subtitle">{{ $baby->name ?: 'Bebé' }}</p>
    <p class="meta">Generado el {{ $generatedAt->translatedFormat('j \d\e F \d\e Y, H:i') }}</p>

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

        <table class="bucket-table">
            @foreach ($feed['by_hour_bucket'] as $bucket)
                <tr>
                    <td>{{ $hourBucketLabels[$bucket['key']] }}</td>
                    <td>{{ (int) round($bucket['value']) }} tomas</td>
                </tr>
            @endforeach
        </table>
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

        <table class="bucket-table">
            @foreach ($sleep['by_hour_bucket'] as $bucket)
                <tr>
                    <td>{{ $hourBucketLabels[$bucket['key']] }}</td>
                    <td>{{ intdiv((int) round($bucket['value']), 60) }}h {{ (int) round($bucket['value']) % 60 }}min</td>
                </tr>
            @endforeach
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
        <table class="bucket-table">
            @foreach ($diaper['pee_by_hour_bucket'] as $bucket)
                <tr>
                    <td>{{ $hourBucketLabels[$bucket['key']] }}</td>
                    <td>{{ (int) round($bucket['value']) }}</td>
                </tr>
            @endforeach
        </table>

        <p class="stats-label" style="margin-bottom: 4px;">Caca por franja</p>
        <table class="bucket-table">
            @foreach ($diaper['poop_by_hour_bucket'] as $bucket)
                <tr>
                    <td>{{ $hourBucketLabels[$bucket['key']] }}</td>
                    <td>{{ (int) round($bucket['value']) }}</td>
                </tr>
            @endforeach
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
                <table class="growth-table">
                    <thead>
                        <tr>
                            <th>{{ $metric['label'] }}</th>
                            <th>Percentil</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($metric['stat']['points'] as $point)
                            <tr>
                                <td>
                                    {{ \Carbon\CarbonImmutable::parse($point['date'])->translatedFormat('j \d\e F \d\e Y') }}
                                    — {{ number_format($point['value'], $metric['decimals']) }} {{ $metric['unit'] }}
                                </td>
                                <td>{{ $point['percentile'] !== null ? round($point['percentile']) : '—' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
                @if ($metric['stat']['gained'] !== null)
                    <p class="empty" style="font-style: normal; margin-top: -8px;">
                        {{ $metric['stat']['gained'] > 0 ? '+' : '' }}{{ number_format($metric['stat']['gained'], $metric['decimals']) }} {{ $metric['unit'] }} desde el primer registro
                    </p>
                @endif
            @endif
        @endforeach
    @endif

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Estadísticas</div>
</body>
</html>
