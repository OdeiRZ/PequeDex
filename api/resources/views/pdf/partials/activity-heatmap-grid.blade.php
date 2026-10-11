{{-- Misma rejilla 7x24 que ActivityHeatmap.vue en pantalla, sin los
     botones tocables (aquí no hay interacción) - cada celda es un
     <td> coloreado por densidad en vez de un elemento con opacidad
     CSS, mismo resultado visual con tablas llanas en vez de grid. Como
     en papel no se puede tocar una celda para ver su detalle, cada
     casilla con actividad lleva su número escrito, y debajo va una
     leyenda de la escala de color. --}}
@php
    $dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
@endphp
<table style="width: 100%; border-collapse: collapse; margin: 0 0 6px; table-layout: fixed;">
    <tr>
        <td style="width: 26px;"></td>
        @for ($hour = 0; $hour < 24; $hour += 3)
            <td colspan="3" style="font-size: 8px; color: #7a6f66; text-align: left; padding-bottom: 2px;">{{ sprintf('%02d h', $hour) }}</td>
        @endfor
    </tr>
    @foreach ($dayLabels as $dayIndex => $dayLabel)
        <tr>
            <td style="width: 26px; font-size: 9px; color: #7a6f66;">{{ $dayLabel }}</td>
            @for ($hour = 0; $hour < 24; $hour++)
                @php
                    $count = $heatmapGrid[$dayIndex][$hour];
                    $opacity = $count > 0 && $heatmapMax > 0 ? max(0.12, $count / $heatmapMax) : 0;
                    $textColor = $opacity >= 0.55 ? '#ffffff' : '#2b2420';
                @endphp
                <td style="height: 16px; background-color: {{ $count > 0 ? "rgba(47, 110, 104, $opacity)" : '#f6f1ec' }}; border: 1px solid #ffffff; text-align: center; font-size: 7px; color: {{ $textColor }};">{{ $count > 0 ? $count : '' }}</td>
            @endfor
        </tr>
    @endforeach
</table>
<table style="border-collapse: collapse; margin: 0 0 14px 26px;">
    <tr>
        <td style="font-size: 8px; color: #7a6f66; padding-right: 6px;">Menos</td>
        <td style="width: 14px; height: 10px; background-color: #f6f1ec; border: 1px solid #ffffff;"></td>
        @foreach ([0.25, 0.5, 0.75, 1] as $step)
            <td style="width: 14px; height: 10px; background-color: rgba(47, 110, 104, {{ $step }}); border: 1px solid #ffffff;"></td>
        @endforeach
        <td style="font-size: 8px; color: #7a6f66; padding-left: 6px;">Más (máx. {{ $heatmapMax }} en una hora)</td>
    </tr>
</table>
