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
           language, table markup. */
        body { font-family: sans-serif; font-size: 14px; color: #2b2420; }
        h1 { font-size: 26px; margin-bottom: 2px; color: #1a1a1a; }
        .subtitle { color: #7a6f66; margin-bottom: 20px; font-size: 15px; }
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
    </style>
</head>
<body>
    <h1>Contracciones</h1>
    <p class="subtitle">{{ $baby->name ?: 'Bebé' }}</p>

    <table>
        <thead>
            <tr>
                <th style="width: 7%;">#</th>
                <th style="width: 29%;">Inicio de contracción</th>
                <th style="width: 29%;">Fin de contracción</th>
                <th style="width: 12%;">Duración</th>
                <th class="num" style="width: 23%;">Intensidad</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($groups as $day => $rows)
                <tr class="day-header">
                    <td colspan="5">{{ $day }}</td>
                </tr>
                @foreach ($rows as $row)
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
                @endforeach
            @endforeach
        </tbody>
    </table>
</body>
</html>
