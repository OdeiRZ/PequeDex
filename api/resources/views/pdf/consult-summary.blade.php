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
        @page { margin: 34px 34px 40px; }
        body { font-family: sans-serif; font-size: 11px; color: #2b2420; }
        .head { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .head td { padding: 0; vertical-align: bottom; }
        .title { font-size: 19px; font-weight: bold; }
        .baby { font-size: 12px; color: #7a6f66; margin-top: 2px; }
        .meta { text-align: right; font-size: 9px; color: #7a6f66; }

        .card { border: 1px solid #efe6dc; border-radius: 12px; padding: 7px 6px 4px; margin: 0 0 8px; }
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

        .questions { border: 1px dashed #c7bcae; border-radius: 10px; padding: 8px 10px; min-height: 70px; font-size: 11px; white-space: pre-line; }
        .line { border-bottom: 1px solid #e8ddd0; height: 18px; }

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

    <table class="head">
        <tr>
            <td>
                <div class="title">Resumen para la consulta</div>
                <div class="baby">
                    {{ $baby->name ?: 'Bebé' }} · {{ $babyAge['value'] }} {{ $babyAge['unit'] }}@if ($sexLabel) · {{ $sexLabel }}@endif
                    @if ($baby->birth_date) · nació el {{ $fmtDay($baby->birth_date) }}@endif
                </div>
            </td>
            <td class="meta">
                Del {{ $since->format('d/m/Y') }} al {{ $generatedAt->format('d/m/Y') }}<br>
                Generado el {{ $generatedAt->format('d/m/Y H:i') }}
            </td>
        </tr>
    </table>

    {{-- Preguntas: arriba, es lo primero que se quiere tener a mano en
         la consulta. Sin preguntas escritas, líneas en blanco para
         apuntarlas a mano. --}}
    <div class="card">
        <div class="card-title"><span class="bar" style="background: #a65a6b;"></span>Preguntas para la consulta</div>
        <div style="margin: 0 6px 4px;">
            @if ($questions)
                <div class="questions">{{ $questions }}</div>
            @else
                <div class="line"></div><div class="line"></div><div class="line"></div>
            @endif
        </div>
    </div>

    @php
        $sections = [
            ['title' => 'Crecimiento (última medida)', 'color' => '#a65a6b', 'tiles' => $growthTiles],
            ['title' => 'Alimentación', 'color' => '#c98a3e', 'tiles' => [
                ['label' => 'Tomas al día', 'value' => $feed['average_per_day'] !== null ? $fmtNum($feed['average_per_day']) : null],
                ['label' => 'Cada cuánto come', 'value' => $feed['average_gap_minutes'] !== null ? $fmtMin($feed['average_gap_minutes']) : null],
                ['label' => 'Al pecho / biberón', 'value' => $feed['total'] > 0 ? round($feed['by_type']['pecho'] / $feed['total'] * 100).'% / '.round($feed['by_type']['biberon'] / $feed['total'] * 100).'%' : null],
                ['label' => 'Cantidad media (biberón)', 'value' => $feed['average_bottle_amount_ml'] !== null ? round($feed['average_bottle_amount_ml']).' ml' : null],
                ['label' => 'Duración media (pecho)', 'value' => $feed['average_pecho_duration_minutes'] !== null ? $fmtMin($feed['average_pecho_duration_minutes']) : null],
            ]],
            ['title' => 'Sueño', 'color' => '#5b5a8c', 'tiles' => [
                ['label' => 'Total al día', 'value' => $sleep['average_total_sleep_minutes'] !== null ? $fmtMin($sleep['average_total_sleep_minutes']) : null, 'note' => $sleep['average_night_sleep_minutes'] !== null ? 'De noche (20-08h) '.$fmtMin($sleep['average_night_sleep_minutes']) : null, 'note2' => $sleepRef['total_range'] !== null ? 'Recomendado: '.$sleepRef['total_range'].($sleepRef['total_verdict_short'] !== null ? ' · '.$sleepRef['total_verdict_short'] : '') : null],
                ['label' => 'Tramo más largo (media)', 'value' => $sleep['average_longest_stretch_minutes'] !== null ? $fmtMin($sleep['average_longest_stretch_minutes']) : null],
                ['label' => 'Sueños al día', 'value' => $sleep['average_sleeps_per_day'] !== null ? $fmtNum($sleep['average_sleeps_per_day']) : null],            ]],
            ['title' => 'Pañales', 'color' => '#6e9080', 'tiles' => [
                ['label' => 'Con pis al día', 'value' => $diaper['average_pee_per_day'] !== null ? $fmtNum($diaper['average_pee_per_day']) : null],
                ['label' => 'Con caca al día', 'value' => $diaper['average_poop_per_day'] !== null ? $fmtNum($diaper['average_poop_per_day']) : null],
                ['label' => 'Última caca', 'value' => $lastPoopSince],
            ]],
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
            </table>
        </div>
    @endif

    {{-- Vitamina D: solo si hay (o hubo) una pauta. --}}
    @if ($vitaminD['has_schedule'])
        <div class="card">
            <div class="card-title"><span class="bar" style="background: #b8742e;"></span>Vitamina D</div>
            <p class="muted">Dosis dadas: {{ $vitaminD['given'] }} de {{ $vitaminD['total_days'] }} días de la pauta.</p>
        </div>
    @endif

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Resumen para la consulta · Datos registrados por la familia, no sustituyen la valoración del pediatra.</div>
</body>
</html>
