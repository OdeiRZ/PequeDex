{{-- Misma rejilla 7x24 que ActivityHeatmap.vue en pantalla, sin los
     botones tocables (aquí no hay interacción) - cada celda es un
     <td> coloreado por densidad en vez de un elemento con opacidad
     CSS, mismo resultado visual con tablas llanas en vez de grid. --}}
@php
    $dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
@endphp
<table style="width: 100%; border-collapse: collapse; margin: 0 0 14px;">
    <tr>
        <td style="width: 16px;"></td>
        @for ($hour = 0; $hour < 24; $hour += 6)
            <td colspan="6" style="font-size: 8px; color: #7a6f66; text-align: left; padding-bottom: 2px;">{{ sprintf('%02d:00', $hour) }}</td>
        @endfor
    </tr>
    @foreach ($dayLabels as $dayIndex => $dayLabel)
        <tr>
            <td style="width: 16px; font-size: 9px; color: #7a6f66;">{{ $dayLabel }}</td>
            @for ($hour = 0; $hour < 24; $hour++)
                @php
                    $count = $heatmapGrid[$dayIndex][$hour];
                    $opacity = $heatmapMax > 0 ? max(0.08, $count / $heatmapMax) : 0;
                @endphp
                <td style="height: 13px; background-color: rgba(47, 110, 104, {{ $opacity }}); border: 1px solid #ffffff;"></td>
            @endfor
        </tr>
    @endforeach
</table>
