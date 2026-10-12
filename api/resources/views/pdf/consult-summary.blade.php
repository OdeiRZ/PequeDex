<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Resumen para la consulta</title>
    <style>
        /* Una sola página para enseñar al pediatra: mismos colores y
           fichas que pdf/stats.blade.php, pero más compacto (fichas de 3
           en 3, sin gráficas) y solo lo que suele preguntarse en una
           revisión. Los datos son los mismos del export de estadísticas,
           calculados en el frontend sobre los últimos 14 días. */
        @page { margin: 28px 34px 38px; }
        body { font-family: sans-serif; font-size: 11px; color: #2b2420; }
        /* Ficha del bebé: lo primero que se mira, así que grande. */
        .hero { background: #f7efe7; border: 1px solid #efe6dc; border-radius: 14px; padding: 12px 16px 6px; margin: 0 0 8px; }
        .hero-head { width: 100%; border-collapse: collapse; }
        .hero-head td { padding: 0; vertical-align: top; }
        .eyebrow { font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #a65a6b; }
        .name { font-size: 30px; font-weight: bold; margin: 2px 0 0; }
        .age { font-size: 15px; color: #5c5149; margin-top: 1px; }
        .meta { text-align: right; font-size: 9px; color: #7a6f66; }
        table.hero-tiles { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 10px -6px 4px; }
        table.hero-tiles td { background: #ffffff; border: 1px solid #efe6dc; border-radius: 10px; padding: 6px 9px; vertical-align: top; }
        .hero-label { display: block; font-size: 8.5px; color: #7a6f66; margin-bottom: 1px; }
        .hero-value { display: block; font-size: 14px; font-weight: bold; }
        .pill { display: inline-block; background: #f3ece4; border-radius: 12px; padding: 3px 9px; margin: 0 5px 4px 0; font-size: 10px; font-weight: bold; }
        .pill .muted-text { color: #7a6f66; font-weight: normal; }
        .pill .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 3px; }
        .sub-label { font-size: 9px; color: #7a6f66; margin: 6px 6px 3px; }

        .card { border: 1px solid #efe6dc; border-radius: 12px; padding: 6px 6px 3px; margin: 0 0 6px; }
        .card-title { font-size: 12px; font-weight: bold; margin: 1px 6px 5px; }
        .card-title .bar { display: inline-block; width: 4px; height: 11px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }

        table.tiles { width: 100%; border-collapse: separate; border-spacing: 6px 5px; margin: -5px 0 0; }
        table.tiles td { background: #f3ece4; border-radius: 9px; padding: 6px 8px; vertical-align: top; }
        table.tiles td.empty { background: none; }
        .tile-label { display: block; font-size: 8.5px; color: #7a6f66; margin-bottom: 1px; }
        .tile-value { display: block; font-size: 13px; font-weight: bold; }
        .tile-note { display: block; font-size: 8px; color: #7a6f66; }

        .rows { width: 100%; border-collapse: collapse; margin: 0 0 3px; }
        .rows td { padding: 3px 6px; border-bottom: 1px solid #f3ece4; font-size: 10px; }
        .rows td.right { text-align: right; color: #7a6f66; white-space: nowrap; }
        .muted { color: #7a6f66; font-size: 10px; margin: 0 6px 4px; }

        .questions { font-size: 11px; line-height: 1.35; white-space: pre-line; padding: 0 0 2px; }

        .footer { position: fixed; bottom: -26px; left: 0; right: 0; text-align: center; font-size: 8px; color: #a3968a; }
        .footer img { vertical-align: middle; margin-right: 4px; width: 10px; height: 12px; }
    </style>
</head>
<body>
    @php
        $fmtMin = function ($minutes) {
            $rounded = (int) round($minutes);
            $hours = intdiv($rounded, 60);

            return $hours > 0 ? $hours.'h '.($rounded % 60).'min' : ($rounded % 60).'min';
        };
        $fmtNum = fn ($v) => number_format($v, 1, ',', '');
        $fmtDay = fn ($d) => \Carbon\CarbonImmutable::parse($d)->format('d/m/Y');
        $since = $generatedAt->subDays(13);
        $sexLabel = $baby->sex?->value === 'nino' ? 'Niño' : ($baby->sex?->value === 'nina' ? 'Niña' : null);

        // Fichas de 3 en 3 (las de valor null se omiten).
        $rowsOf = function (array $tiles) {
            return array_chunk(array_values(array_filter($tiles, fn ($t) => $t['value'] !== null)), 3);
        };
        $growthTiles = collect($growthMetrics)->map(fn ($m) => [
            'label' => $m['label'],
            'value' => $m['stat']['latest_value'] !== null ? number_format($m['stat']['latest_value'], $m['decimals'], ',', '').' '.$m['unit'] : null,
            'note' => trim(($m['stat']['latest_percentile'] !== null ? 'Percentil '.round($m['stat']['latest_percentile']) : '').($m['lastDate'] ? ' · '.$m['lastDate'] : ''), ' ·'),
        ])->all();
    @endphp

    @php
        $heroTiles = array_values(array_filter([
            ['label' => 'Edad', 'value' => $babyAge['value'] !== null ? $babyAge['value'].' '.$babyAge['unit'] : null],
            ['label' => 'Sexo', 'value' => $sexLabel],
            ['label' => 'Nació el', 'value' => $baby->birth_date ? $fmtDay($baby->birth_date) : null],
            ['label' => 'Periodo', 'value' => $since->format('d/m').' – '.$generatedAt->format('d/m/Y')],
        ], fn ($t) => $t['value'] !== null));
    @endphp
    <div class="hero">
        <table class="hero-head">
            <tr>
                <td>
                    <div class="eyebrow">Resumen para la consulta</div>
                    <div class="name">{{ $baby->name ?: 'Bebé' }}</div>
                    @if ($babyAge['value'] !== null)
                        <div class="age">{{ $babyAge['value'] }} {{ $babyAge['unit'] }}@if ($sexLabel) · {{ $sexLabel }}@endif</div>
                    @endif
                </td>
                <td class="meta">
                    Generado el {{ $generatedAt->format('d/m/Y H:i') }}<br>
                    Datos de los últimos 14 días
                </td>
            </tr>
        </table>
        <table class="hero-tiles">
            <tr>
                @foreach ($heroTiles as $tile)
                    <td style="width: {{ round(100 / count($heroTiles), 2) }}%;">
                        <span class="hero-label">{{ $tile['label'] }}</span>
                        <span class="hero-value">{{ $tile['value'] }}</span>
                    </td>
                @endforeach
            </tr>
        </table>
    </div>

    @php
        $sections = [
            ['title' => 'Crecimiento (última medida)', 'color' => '#a65a6b', 'tiles' => $growthTiles],
            ['title' => 'Alimentación', 'color' => '#c98a3e', 'tiles' => [
                ['label' => 'Tomas registradas', 'value' => $feed['total'] > 0 ? $feed['total'] : null, 'note' => 'En los últimos 14 días'],
                ['label' => 'Tomas al día', 'value' => $feed['average_per_day'] !== null ? $fmtNum($feed['average_per_day']) : null],
                ['label' => 'Cada cuánto come', 'value' => $feed['average_gap_minutes'] !== null ? $fmtMin($feed['average_gap_minutes']) : null],
                ['label' => 'Al pecho / biberón', 'value' => $feed['total'] > 0 ? round($feed['by_type']['pecho'] / $feed['total'] * 100).'% / '.round($feed['by_type']['biberon'] / $feed['total'] * 100).'%' : null, 'note' => $feed['by_type']['pecho'] > 0 ? 'Pecho: izq. '.$feed['pecho_side_counts']['izquierdo'].' · der. '.$feed['pecho_side_counts']['derecho'].' · ambos '.$feed['pecho_side_counts']['ambos'] : null],
                ['label' => 'Cantidad media (biberón)', 'value' => $feed['average_bottle_amount_ml'] !== null ? round($feed['average_bottle_amount_ml']).' ml' : null],
                ['label' => 'Duración media (pecho)', 'value' => $feed['average_pecho_duration_minutes'] !== null ? $fmtMin($feed['average_pecho_duration_minutes']) : null],
            ]],
            ['title' => 'Sueño', 'color' => '#5b5a8c', 'tiles' => [
                ['label' => 'Total al día', 'value' => $sleep['average_total_sleep_minutes'] !== null ? $fmtMin($sleep['average_total_sleep_minutes']) : null, 'note' => $sleep['average_night_sleep_minutes'] !== null ? 'De noche (20-08h) '.$fmtMin($sleep['average_night_sleep_minutes']) : null, 'note2' => $sleepRef['total_range'] !== null ? 'Recomendado: '.$sleepRef['total_range'].($sleepRef['total_verdict_short'] !== null ? ' · '.$sleepRef['total_verdict_short'] : '') : null],
                ['label' => 'Tramo más largo (media)', 'value' => $sleep['average_longest_stretch_minutes'] !== null ? $fmtMin($sleep['average_longest_stretch_minutes']) : null],
                ['label' => 'Sueños al día', 'value' => $sleep['average_sleeps_per_day'] !== null ? $fmtNum($sleep['average_sleeps_per_day']) : null],
                ['label' => 'Duración media de cada sueño', 'value' => $sleep['average_duration_minutes'] !== null ? $fmtMin($sleep['average_duration_minutes']) : null],
                ['label' => 'Despierto entre sueños', 'value' => $sleep['average_wake_window_minutes'] !== null ? $fmtMin($sleep['average_wake_window_minutes']) : null, 'note' => $sleepRef['wake_window'] ?? null],
                ['label' => 'Sueño de día', 'value' => $sleep['average_day_sleep_minutes'] !== null ? $fmtMin($sleep['average_day_sleep_minutes']) : null],
            ], 'extra' => 'sleepChart'],
            ['title' => 'Pañales', 'color' => '#6e9080', 'tiles' => [
                ['label' => 'Con pis al día', 'value' => $diaper['average_pee_per_day'] !== null ? $fmtNum($diaper['average_pee_per_day']) : null, 'note' => $diaper['total'].' cambios en total'],
                ['label' => 'Con caca al día', 'value' => $diaper['average_poop_per_day'] !== null ? $fmtNum($diaper['average_poop_per_day']) : null],
                ['label' => 'Última caca', 'value' => $lastPoopSince],
            ], 'extra' => 'poopColors'],
        ];
    @endphp

    @foreach ($sections as $section)
        @php $rows = $rowsOf($section['tiles']); @endphp
        <div class="card">
            <div class="card-title"><span class="bar" style="background: {{ $section['color'] }};"></span>{{ $section['title'] }}</div>
            @if (count($rows) === 0)
                <p class="muted">Sin datos suficientes en estos 14 días.</p>
            @else
                <table class="tiles">
                    @foreach ($rows as $row)
                        <tr>
                            @foreach ($row as $tile)
                                <td style="width: 33.33%;">
                                    <span class="tile-label">{{ $tile['label'] }}</span>
                                    <span class="tile-value">{{ $tile['value'] }}</span>
                                    @if (! empty($tile['note']))
                                        <span class="tile-note">{{ $tile['note'] }}</span>
                                    @endif
                                    @if (! empty($tile['note2']))
                                        <span class="tile-note">{{ $tile['note2'] }}</span>
                                    @endif
                                </td>
                            @endforeach
                            @for ($i = count($row); $i < 3; $i++)
                                <td class="empty" style="width: 33.33%;"></td>
                            @endfor
                        </tr>
                    @endforeach
                </table>
            @endif

            {{-- Extras de cada sección: los mismos datos que ya recibe el PDF
                 completo, aquí en pequeño. --}}
            @if (($section['extra'] ?? null) === 'sleepChart')
                <p class="sub-label">Horas de sueño, últimos 7 días</p>
                <div style="margin: 0 4px;">
                    @include('pdf.partials.vertical-bars', [
                        'points' => $dailySleepPoints,
                        'color' => $section['color'],
                        'format' => fn ($value) => number_format($value, 1, ',', '').' h',
                        'highlightLast' => true,
                        'height' => 36,
                    ])
                </div>
            @elseif (($section['extra'] ?? null) === 'poopColors' && count($poopColorRows) > 0)
                <p class="sub-label">Color de las cacas</p>
                <div style="margin: 0 6px 2px;">
                    @foreach ($poopColorRows as $row)
                        <span class="pill">@if ($row['hex'])<span class="dot" style="background: {{ $row['hex'] }};"></span>@endif{{ $row['label'] }} <span class="muted-text">· {{ $row['count'] }}</span></span>
                    @endforeach
                </div>
            @endif
        </div>
    @endforeach

    {{-- Temperatura: solo si el bebé tiene alguna medición registrada. --}}
    @if ($temperature !== null)
        <div class="card">
            <div class="card-title"><span class="bar" style="background: #c0603f;"></span>Temperatura</div>
            @if (count($highTemperatures) > 0)
                <table class="rows">
                    @foreach ($highTemperatures as $reading)
                        <tr>
                            <td><b>{{ number_format($reading['celsius'], 1, ',', '') }} °C</b></td>
                            <td class="right">{{ \Carbon\CarbonImmutable::parse($reading['at'])->format('d/m/Y H:i') }}</td>
                        </tr>
                    @endforeach
                </table>
            @else
                <p class="muted">
                    Ninguna medición de 38 °C o más en estos 14 días
                    @if ($temperature['count'] > 0)
                        ({{ $temperature['count'] }} {{ $temperature['count'] === 1 ? 'medición' : 'mediciones' }}, máxima {{ number_format($temperature['max']['celsius'], 1, ',', '') }} °C).
                    @else
                        (sin mediciones).
                    @endif
                </p>
            @endif
        </div>
    @endif

    {{-- Vacunas y revisiones: solo si están activadas. --}}
    @if ($vaccinations !== null)
        <div class="card">
            <div class="card-title"><span class="bar" style="background: #4f9a62;"></span>Vacunas y revisiones</div>
            <table class="rows">
                <tr>
                    <td>Vacunas puestas</td>
                    <td class="right">{{ $vaccinations['given'] }}/{{ $vaccinations['total'] }}@if ($vaccinations['overdue'] > 0) · {{ $vaccinations['overdue'] }} con fecha pasada @endif</td>
                </tr>
                @foreach ($recentVaccines as $v)
                    <tr>
                        <td>Puesta: {{ $v['name'] }}</td>
                        <td class="right">{{ $fmtDay($v['date']) }}</td>
                    </tr>
                @endforeach
                @if (count($vaccinations['upcoming_list']) > 0)
                    <tr>
                        <td>Próxima: {{ $vaccinations['upcoming_list'][0]['name'] }}</td>
                        <td class="right">{{ $vaccinations['upcoming_list'][0]['date'] ? $fmtDay($vaccinations['upcoming_list'][0]['date']) : 'Sin fecha' }}</td>
                    </tr>
                @endif
                @if ($vaccinations['next_checkup'] !== null)
                    <tr>
                        <td>Próxima revisión: {{ $vaccinations['next_checkup']['reason'] ?: 'Revisión' }}</td>
                        <td class="right">{{ \Carbon\CarbonImmutable::parse($vaccinations['next_checkup']['at'])->format('d/m/Y H:i') }}</td>
                    </tr>
                @endif
                @if ($vitaminD['has_schedule'])
                    <tr>
                        <td>Vitamina D: dosis dadas</td>
                        <td class="right">{{ $vitaminD['given'] }} de {{ $vitaminD['total_days'] }} días de la pauta</td>
                    </tr>
                @endif
            </table>
        </div>
    @endif

    {{-- Vitamina D: solo si hay (o hubo) una pauta. Con las vacunas
         activadas va como una fila de su tarjeta, para no gastar otra. --}}
    @if ($vitaminD['has_schedule'] && $vaccinations === null)
        <div class="card">
            <div class="card-title"><span class="bar" style="background: #b8742e;"></span>Vitamina D</div>
            <p class="muted">Dosis dadas: {{ $vitaminD['given'] }} de {{ $vitaminD['total_days'] }} días de la pauta.</p>
        </div>
    @endif

    {{-- Preguntas: al final y solo si se han escrito; sin ellas no hay
         bloque ni líneas en blanco. --}}
    @if (filled($questions))
        <div class="card" style="page-break-inside: avoid;">
            <div class="card-title"><span class="bar" style="background: #a65a6b;"></span>Preguntas para la consulta</div>
            <div style="margin: 0 6px 4px;">
                <div class="questions">{{ $questions }}</div>
            </div>
        </div>
    @endif

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Resumen para la consulta · Datos registrados por la familia, no sustituyen la valoración del pediatra.</div>
</body>
</html>
