{{-- Reutilizado por Tomas/Sueño/Pis/Caca - 2 franjas por fila en vez de
     1 a todo lo ancho. $format recibe el valor crudo de la franja y
     decide cómo mostrarlo (cada sección lo formatea distinto: "3
     tomas", "1h 20min", o un número suelto). --}}
@php
    $pairs = array_chunk($buckets, 2);
@endphp
<table class="bucket-grid">
    @foreach ($pairs as $pair)
        <tr>
            @foreach ($pair as $bucket)
                <td>
                    <span class="stats-label">{{ $labels[$bucket['key']] }}</span>
                    <span class="stats-value">{{ $format($bucket['value']) }}</span>
                </td>
            @endforeach
        </tr>
    @endforeach
</table>
