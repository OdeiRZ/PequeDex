{{-- Mismo criterio que bucket-grid.blade.php - 2 mediciones por fila
     en vez de 1 a todo lo ancho, con el percentil apretado al final. --}}
@php
    $pairs = array_chunk($points, 2);
@endphp
<table class="bucket-grid">
    @foreach ($pairs as $pair)
        <tr>
            @foreach ($pair as $point)
                <td>
                    <span class="stats-label">{{ \Carbon\CarbonImmutable::parse($point['date'])->translatedFormat('j \d\e F \d\e Y') }}</span>
                    <span class="stats-value">{{ number_format($point['value'], $decimals) }} {{ $unit }}</span>
                    @if ($point['percentile'] !== null)
                        <span class="stats-note">Percentil {{ round($point['percentile']) }}</span>
                    @endif
                </td>
            @endforeach
        </tr>
    @endforeach
</table>
