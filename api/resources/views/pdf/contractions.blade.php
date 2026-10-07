<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Contracciones</title>
    <style>
        /* dompdf only understands a subset of CSS - kept deliberately
           plain (no flex/grid) to render reliably. Colors/shapes echo the
           app's own screen: olive-green day bar, light-grey rows, brand
           maroon for bold values and the intensity bolts (same path as
           the app's own icon, passed in as two data-URI <img> sources -
           a raw inline <svg> tag doesn't render at all in this dompdf
           setup, confirmed with an isolated test, and neither does the
           Unicode "●" tried before that, which came out as "?" with the
           default font), bordered pill for the interval - same visual
           language, table markup. The water-break row uses a blue
           (#3f7ea6, one of the app's own alternate brand hues) instead of
           the maroon used everywhere else, so it reads as a distinct
           kind of event on the timeline, not just another stat. */
        body { font-family: sans-serif; font-size: 14px; color: #2b2420; }
        h1 { font-size: 26px; margin-bottom: 14px; color: #1a1a1a; }

        /* Fija en la parte superior de CADA página, igual que .footer ya
           hace en la inferior. */
        .header { position: fixed; top: -30px; left: 0; right: 0; text-align: right; font-size: 10px; color: #a3968a; }

        /* Mismo formato que la tarjeta principal del bebé en el dashboard
           y que la cabecera de pdf/stats.blade.php: nombre + sexo arriba,
           titular en grande + fecha debajo, sobre un degradado de marca
           con dos círculos decorativos traslúcidos. A diferencia de
           Estadísticas (solo alcanzable con el bebé ya nacido),
           Contracciones es justo lo contrario - solo mientras el bebé NO
           ha nacido todavía -, así que el titular es la cuenta atrás a la
           fecha prevista en vez de la edad, vía el mismo
           BabyAgeHeadline::forBaby() que ya usa Estadísticas (comparte
           las tres variantes - nacido/previsto/sin fecha - en vez de
           reimplementar el cálculo aquí). */
        table.baby-card { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
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
        .baby-card-special { font-size: 24px; font-weight: bold; }
        .baby-card-born { font-size: 14px; opacity: 0.95; }

        table.stats-bar { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 18px -8px; }
        table.stats-bar td { width: 33.33%; background: #f3ece4; border-radius: 8px; padding: 10px 14px; text-align: center; }
        .stats-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; margin-bottom: 4px; }
        .stats-value { display: block; font-size: 19px; font-weight: bold; color: #a65a6b; }

        table { width: 100%; border-collapse: separate; border-spacing: 0 6px; }
        th { text-align: right; padding: 4px 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; }
        td { padding: 10px; vertical-align: top; background: #f3ece4; text-align: right; }
        td:first-child { border-radius: 8px 0 0 8px; }
        td:last-child { border-radius: 0 8px 8px 0; }
        tr.day-header td { background: #8a9a5b; color: #fff; font-weight: bold; padding: 7px 10px; border-radius: 8px; font-size: 15px; text-align: center; }
        tr.interval-row td { background: transparent; padding: 0 10px 6px; text-align: right; }
        .interval-pill { display: inline-block; border: 1px solid #d8cdc0; border-radius: 10px; padding: 3px 10px; color: #7a6f66; font-size: 13px; }
        .interval-pill b { color: #2b2420; }
        .num-cell { color: #a3968a; font-size: 13px; }
        .duration { font-weight: bold; font-size: 16px; color: #a65a6b; }
        .bolts { text-align: right; }
        .bolts img { margin-left: 4px; width: 20px; height: 20px; }

        tr.water-row td { background: #dce9f0; border-top: 1.5px solid #3f7ea6; border-bottom: 1.5px solid #3f7ea6; }
        tr.water-row td:first-child { border-left: 1.5px solid #3f7ea6; border-radius: 8px 0 0 8px; }
        tr.water-row td:nth-child(2) { font-weight: bold; color: #2b2420; }
        tr.water-row td:last-child { border-right: 1.5px solid #3f7ea6; border-radius: 0 8px 8px 0; color: #3f7ea6; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-size: 13px; text-align: center; }
        .water-row-icon { width: 20px; height: 20px; }

        .footer { position: fixed; bottom: -35px; left: 0; right: 0; text-align: center; font-size: 10px; color: #a3968a; border-top: 1px solid #e8ddd0; padding-top: 6px; }
        .footer img { vertical-align: middle; margin-right: 5px; width: 13px; height: 16px; }
    </style>
</head>
<body>
    <div class="header">Generado el {{ $generatedAt->translatedFormat('j \d\e F \d\e Y, H:i') }}</div>
    <h1>Contracciones</h1>

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
                                @if ($babyAge['special'])
                                    <span class="baby-card-special">{{ $babyAge['special'] }}</span>
                                @elseif ($babyAge['value'] !== null)
                                    <span class="baby-card-age">{{ $babyAge['value'] }} <span>{{ $babyAge['unit'] }}</span></span>
                                @endif
                            </td>
                            <td style="text-align: right; width: 38%; vertical-align: bottom;">
                                @if ($babyAge['type'] === 'born' && $baby->birth_date)
                                    <span class="baby-card-born">Nació el {{ \Carbon\CarbonImmutable::parse($baby->birth_date)->translatedFormat('j \d\e F \d\e Y') }}</span>
                                @elseif ($baby->due_date)
                                    <span class="baby-card-born">Fecha prevista: {{ \Carbon\CarbonImmutable::parse($baby->due_date)->translatedFormat('j \d\e F \d\e Y') }}</span>
                                @endif
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <table class="stats-bar">
        <tr>
            <td>
                <span class="stats-label">Contracciones</span>
                <span class="stats-value">{{ $totalContractions }}</span>
            </td>
            <td>
                <span class="stats-label">Duración media</span>
                <span class="stats-value">{{ $avgDuration ?? '—' }}</span>
            </td>
            <td>
                <span class="stats-label">Intervalo medio</span>
                <span class="stats-value">{{ $avgInterval ?? '—' }}</span>
            </td>
        </tr>
    </table>

    <table>
        <thead>
            <tr>
                <th style="width: 7%;">#</th>
                <th style="width: 29%;">Inicio de contracción</th>
                <th style="width: 29%;">Fin de contracción</th>
                <th style="width: 16%;">Duración</th>
                <th class="num" style="width: 19%;">Intensidad</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($groups as $day => $rows)
                <tr class="day-header">
                    <td colspan="5">{{ $day }}</td>
                </tr>
                @foreach ($rows as $row)
                    @if ($row['type'] === 'water')
                        <tr class="water-row">
                            <td><img src="{{ $waterIcon }}" class="water-row-icon" alt="" /></td>
                            <td>{{ $row['at']->translatedFormat('j \d\e F, H:i') }}</td>
                            <td colspan="3">Rotura de bolsa de aguas</td>
                        </tr>
                    @else
                        <tr>
                            <td class="num-cell">#{{ $row['number'] }}</td>
                            <td>{{ $row['started_at']->translatedFormat('j \d\e F, H:i') }}</td>
                            <td>{{ $row['ended_at']?->translatedFormat('j \d\e F, H:i') ?? '—' }}</td>
                            <td class="duration">{{ $row['duration'] ?? '—' }}</td>
                            <td class="bolts">
                                @for ($bolt = 0; $bolt < 3; $bolt++)
                                    <img src="{{ $bolt <= $row['intensity'] ? $boltOn : $boltOff }}" width="20" height="20" alt="" />
                                @endfor
                            </td>
                        </tr>
                        @if ($row['interval'] !== null)
                            <tr class="interval-row">
                                <td colspan="5">
                                    <span class="interval-pill">Intervalo: <b>{{ $row['interval'] }}</b></span>
                                </td>
                            </tr>
                        @endif
                    @endif
                @endforeach
            @endforeach
        </tbody>
    </table>

    <div class="footer"><img src="{{ $logo }}" alt="" />PequeDex · Contador de contracciones</div>
</body>
</html>
