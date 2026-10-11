{{-- Barras VERTICALES como HourBucketChart.vue / WeeklySleep.vue /
     WeeklyTrendChart.vue en pantalla: cifra encima, barra que crece
     desde el suelo, rótulo debajo. dompdf no tiene flexbox, pero una
     celda de tabla con `vertical-align: bottom` y un `<div>` con altura
     en px calculada aquí da el mismo dibujo. $point['value'] a `null`
     (semana sin dato) se pinta como marca rayada, no como un 0 - mismo
     criterio que en pantalla. $highlightLast resalta la última barra
     (hoy, en "Sueño esta semana"). --}}
@php
    $chartHeight = $height ?? 64;
    $max = max(1, ...array_map(fn ($p) => $p['value'] ?? 0, $points));
    $lastIndex = count($points) - 1;
@endphp
<table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 4px; table-layout: fixed;">
    <tr>
        @foreach ($points as $point)
            <td style="text-align: center; font-size: 8px; color: #7a6f66; padding: 0 0 2px;">
                {{ $point['value'] !== null && $point['value'] > 0 ? $format($point['value']) : '' }}
            </td>
        @endforeach
    </tr>
    <tr>
        @foreach ($points as $index => $point)
            <td style="height: {{ $chartHeight }}px; vertical-align: bottom; padding: 0;">
                @if ($point['value'] === null)
                    <div style="height: 3px; border-top: 2px dashed #d8cdbf;"></div>
                @elseif ($point['value'] > 0)
                    <div style="height: {{ max(3, round($point['value'] / $max * $chartHeight)) }}px; background: {{ $color }}; border-radius: 4px;"></div>
                @else
                    <div style="height: 3px; background: {{ $color }}; opacity: 0.25; border-radius: 2px;"></div>
                @endif
            </td>
        @endforeach
    </tr>
    <tr>
        @foreach ($points as $index => $point)
            <td style="text-align: center; font-size: 8px; padding-top: 3px; white-space: nowrap; {{ ! empty($highlightLast) && $index === $lastIndex ? 'font-weight: bold; color: '.$color.';' : 'color: #7a6f66;' }}">{{ $point['label'] }}</td>
        @endforeach
    </tr>
</table>
