{{-- Barra HORIZONTAL por semana en vez de la barra vertical de
     WeeklyTrendChart.vue - dompdf no tiene flexbox para crecer una
     altura dinámica, pero un `<div>` con `width` en % es CSS2 llano y
     funciona igual de bien tumbado. $value a `null` (semana sin dato,
     p.ej. sin sueño completado) se pinta como marca hueca en vez de
     barra de 0 - mismo criterio que la barra rayada en pantalla. --}}
@php
    $max = max(1, ...array_map(fn ($p) => $p['value'] ?? 0, $points));
@endphp
<table style="width: 100%; border-collapse: collapse; margin: 0 0 14px;">
    @foreach ($points as $point)
        <tr>
            <td style="width: 54px; font-size: 10px; color: #7a6f66; padding: 3px 6px 3px 0; white-space: nowrap;">{{ $point['label'] }}</td>
            <td style="padding: 3px 0;">
                @if ($point['value'] !== null)
                    <div style="background: {{ $color }}; height: 12px; border-radius: 6px; width: {{ max(4, round($point['value'] / $max * 100)) }}%;"></div>
                @else
                    <div style="height: 10px; border-radius: 6px; border: 1px dashed #c7bcae;"></div>
                @endif
            </td>
            <td style="width: 58px; text-align: right; font-size: 10px; color: #2b2420; padding: 3px 0 3px 6px; white-space: nowrap;">
                {{ $point['value'] !== null ? $format($point['value']) : '—' }}
            </td>
        </tr>
    @endforeach
</table>
