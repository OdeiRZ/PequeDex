{{-- Fichas de 2 en 2 como la rejilla `grid-cols-2` de StatsView.vue:
     fondo hundido, rótulo pequeño arriba a la izquierda y cifra en
     negrita debajo. Cada ficha: ['label' => ..., 'value' => ...,
     'note' => opcional]. Se omiten las de valor `null`, igual que los
     `v-if` de la pantalla. $columns (por defecto 2) permite la fila de
     3 de la comparativa semanal. --}}
@php
    $cols = $columns ?? 2;
    $visible = array_values(array_filter($tiles, fn ($tile) => $tile['value'] !== null));
    $rows = array_chunk($visible, $cols);
@endphp
@if (count($visible) > 0)
    <table class="tiles">
        @foreach ($rows as $row)
            <tr>
                @foreach ($row as $tile)
                    <td style="width: {{ round(100 / $cols, 2) }}%;">
                        <span class="tile-label">{{ $tile['label'] }}</span>
                        <span class="tile-value"@if (! empty($tile['color'])) style="color: {{ $tile['color'] }};"@endif>{{ $tile['value'] }}</span>
                        @if (! empty($tile['note']))
                            <span class="tile-note">{{ $tile['note'] }}</span>
                        @endif
                    </td>
                @endforeach
                @for ($i = count($row); $i < $cols; $i++)
                    <td class="tile-empty" style="width: {{ round(100 / $cols, 2) }}%;"></td>
                @endfor
            </tr>
        @endforeach
    </table>
@endif
