<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Contracciones</title>
    <style>
        /* dompdf only understands a subset of CSS - kept deliberately
           plain (no flex/grid) to render reliably. */
        body { font-family: sans-serif; font-size: 11px; color: #1a1a1a; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        th { text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; }
        td { padding: 8px; vertical-align: top; }
        tr.row-even td { background: #f5f5f5; }
        tr.day-header td { background: #8a9a5b; color: #fff; font-weight: bold; padding: 6px 8px; }
        tr.interval-row td { color: #888; font-size: 10px; padding: 2px 8px 8px; }
        .num { text-align: right; }
    </style>
</head>
<body>
    <h1>Contracciones</h1>
    <p class="subtitle">{{ $baby->name ?: 'Bebé' }}</p>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Duración</th>
                <th class="num">Intensidad</th>
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
                    <tr class="{{ $n % 2 === 0 ? 'row-even' : '' }}">
                        <td>#{{ $n }}</td>
                        <td>{{ $row['started_at']->translatedFormat('j \d\e F, H:i') }}</td>
                        <td>{{ $row['ended_at']?->translatedFormat('j \d\e F, H:i') ?? '—' }}</td>
                        <td>{{ $row['duration'] ?? '—' }}</td>
                        <td class="num">{{ $row['intensity'] }}</td>
                    </tr>
                    @if ($row['interval'] !== null)
                        <tr class="interval-row">
                            <td colspan="5">Intervalo: {{ $row['interval'] }}</td>
                        </tr>
                    @endif
                @endforeach
            @endforeach
        </tbody>
    </table>
</body>
</html>
