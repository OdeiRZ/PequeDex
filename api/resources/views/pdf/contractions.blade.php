<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Contracciones</title>
    <style>
        /* dompdf only understands a subset of CSS - kept deliberately
           plain (no flex/grid) to render reliably. Colors/shapes echo the
           app's own screen: olive-green day bar, light-grey rows, brand
           maroon for bold values and the intensity dots, bordered pill
           for the interval - same visual language, table markup. */
        body { font-family: sans-serif; font-size: 11px; color: #2b2420; }
        h1 { font-size: 20px; margin-bottom: 2px; color: #1a1a1a; }
        .subtitle { color: #7a6f66; margin-bottom: 20px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0 6px; }
        th { text-align: left; padding: 4px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #7a6f66; }
        th.num { text-align: right; }
        td { padding: 10px; vertical-align: top; background: #f3ece4; }
        td:first-child { border-radius: 8px 0 0 8px; }
        td:last-child { border-radius: 0 8px 8px 0; }
        tr.day-header td { background: #8a9a5b; color: #fff; font-weight: bold; padding: 7px 10px; border-radius: 8px; font-size: 12px; }
        tr.interval-row td { background: transparent; padding: 0 10px 6px; text-align: right; }
        .interval-pill { display: inline-block; border: 1px solid #d8cdc0; border-radius: 10px; padding: 3px 10px; color: #7a6f66; font-size: 10px; }
        .interval-pill b { color: #2b2420; }
        .num-cell { color: #a3968a; font-size: 10px; }
        .duration { font-weight: bold; font-size: 13px; color: #a65a6b; }
        .dots { text-align: right; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 4px; }
        .dot-on { background: #a65a6b; }
        .dot-off { background: #e8ddd0; }
    </style>
</head>
<body>
    <h1>Contracciones</h1>
    <p class="subtitle">{{ $baby->name ?: 'Bebé' }}</p>

    <table>
        <thead>
            <tr>
                <th style="width: 8%;">#</th>
                <th style="width: 27%;">Inicio de contracción</th>
                <th style="width: 27%;">Fin de contracción</th>
                <th style="width: 18%;">Duración</th>
                <th class="num" style="width: 20%;">Intensidad</th>
            </tr>
        </thead>
        <tbody>
            @php($n = 0)
            @foreach ($groups as $day => $rows)
                <tr class="day-header">
                    <td colspan="5">{{ $day }}</td>
                </tr>
                @foreach ($rows as $row)
                    @php($n++)
                    <tr>
                        <td class="num-cell">#{{ $n }}</td>
                        <td>{{ $row['started_at']->translatedFormat('j \d\e F, H:i') }}</td>
                        <td>{{ $row['ended_at']?->translatedFormat('j \d\e F, H:i') ?? '—' }}</td>
                        <td class="duration">{{ $row['duration'] ?? '—' }}</td>
                        <td class="dots">
                            @for ($dot = 0; $dot < 3; $dot++)
                                <span class="dot {{ $dot <= $row['intensity'] ? 'dot-on' : 'dot-off' }}"></span>
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
