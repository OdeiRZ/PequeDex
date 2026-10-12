<?php

namespace App\Services\Sleep;

use App\Models\Baby;
use App\Services\Support\Quantiles;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Estimación sencilla y explicable, sin aprendizaje automático: parte de
 * los sueños recientes del propio bebé, con tres refinamientos que usan
 * apps como Napper o Huckleberry:
 *
 * 1. Ventana por número de siesta del día: la primera tras despertar
 *    por la mañana no dura lo mismo que la de antes de dormir por la
 *    noche, así que se promedian por separado (con la hora local del
 *    móvil, `$timezone`). Las tomas de madrugada entre dos tramos de
 *    noche no cuentan como ventana.
 * 2. Ponderada por recencia: cada día anterior pesa un 15 % menos
 *    (el bebé cambia de una semana a otra). Se usa la mediana ponderada
 *    y no la media (ver weightedMedian()).
 * 3. Referencia por edad (WakeWindowReference) como punto de partida:
 *    entra como observaciones más (AGE_PRIOR_WEIGHT), así que con pocos
 *    datos manda y con muchos apenas cuenta. Sin datos propios, la
 *    predicción sale solo de ella (`based_on: age_reference`).
 *
 * Posible mejora pendiente (documentada en api/README.md): acortar la
 * ventana tras una siesta corta. Se dejó fuera porque sus umbrales no
 * tienen referencia publicada.
 *
 * Por dentro trabaja con marcas de tiempo (enteros) y filas sin hidratar,
 * no con modelos y objetos de fecha: en producción (una fracción de CPU)
 * convertir fechas con Carbon unas 120 veces por llamada era casi la mitad
 * del coste de todo el arranque del Dashboard. El resultado es idéntico
 * (comprobado sobre 1.182 predicciones de datos reales).
 */
class SleepPatternPredictor
{
    private const MIN_SAMPLE_SIZE = 3;

    /** Días de historial considerados (con muchos sueños al día, bastan). */
    private const LOOKBACK_DAYS = 14;

    private const MAX_SLEEPS = 120;

    /** Más largo que esto no es una ventana entre sueños, sino un hueco en el registro. */
    private const MAX_WAKE_WINDOW_HOURS = 6;

    /** Observaciones recientes con las que se calcula el rango habitual. */
    private const RANGE_SAMPLE = 20;

    /** Peso que pierde cada día de antigüedad (0,85^días). */
    private const RECENCY_DECAY = 0.85;

    /**
     * Cuántas observaciones "vale" la referencia por edad. 2 y no 1: en un
     * backtest con un mes de datos reales, con más peso en la referencia
     * mejoraba el acierto (±15 min: 37 % con 1, 39 % con 2, 44 % con 5, que
     * ya equivale a usar solo la referencia). Se queda en 2 para que los
     * datos propios sigan contando cuando haya más historial.
     */
    private const AGE_PRIOR_WEIGHT = 2.0;

    /** Mínimo de peso acumulado para usar la media de un número de siesta concreto. */
    private const MIN_ORDINAL_WEIGHT = 1.5;

    /** Un sueño que empieza a partir de esta hora local, o antes de NIGHT_END_HOUR, es de noche. */
    private const NIGHT_START_HOUR = 19;

    private const NIGHT_END_HOUR = 6;

    /**
     * @return array<string, mixed>
     */
    public static function predict(Baby $baby, string $timezone = 'UTC', ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $zone = new DateTimeZone($timezone);

        // Los 14 días anteriores al último sueño registrado (no a hoy:
        // unos días sin registrar no deben dejarlo sin historial).
        $recent = [];
        foreach ($baby->sleeps()->toBase()->orderByDesc('started_at')->limit(self::MAX_SLEEPS)->get(['id', 'started_at', 'ended_at']) as $row) {
            $recent[] = [
                'id' => (int) $row->id,
                'start' => (int) strtotime((string) $row->started_at),
                'end' => $row->ended_at === null ? null : (int) strtotime((string) $row->ended_at),
            ];
        }
        $cutoff = $recent === [] ? null : $recent[0]['start'] - self::LOOKBACK_DAYS * 86400;
        $sleeps = array_values(array_filter($recent, fn (array $s) => $cutoff === null || $s['start'] >= $cutoff));
        // Estable (PHP 8): a igual hora de inicio se mantiene el orden de la consulta.
        usort($sleeps, fn (array $a, array $b) => $a['start'] <=> $b['start']);
        foreach ($sleeps as $i => $sleep) {
            $sleeps[$i]['night'] = self::isNight($sleep['start'], $zone);
        }

        $completed = array_values(array_filter($sleeps, fn (array $s) => $s['end'] !== null));
        $ageReference = WakeWindowReference::forBaby($baby, $now);
        $windows = self::wakeWindows($completed);

        $base = [
            'has_enough_data' => count($completed) >= self::MIN_SAMPLE_SIZE,
            'sample_size' => count($completed),
            'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
            'average_sleep_duration_minutes' => null,
            'average_wake_window_minutes' => null,
            'window_number' => null,
            'age_reference' => $ageReference,
            'prediction' => null,
        ];

        $latest = $sleeps === [] ? null : $sleeps[array_key_last($sleeps)];
        if ($latest === null) {
            return $base;
        }

        if ($base['has_enough_data']) {
            $base['average_sleep_duration_minutes'] = (int) round(self::weightedAverage(
                self::durations($completed),
                $completed[array_key_last($completed)]['end'],
            )['value']);
        }

        // Dormido ahora mismo: cuánto suele durar un sueño de ese tipo
        // (noche o siesta), con la mediana ponderada por recencia (en el
        // backtest, mejor que la media sobre todo en siestas). El campo
        // sigue llamándose `average_...` por compatibilidad con la app.
        if ($latest['end'] === null) {
            if (! $base['has_enough_data']) {
                return $base;
            }
            $sameKind = array_values(array_filter($completed, fn (array $s) => $s['night'] === $latest['night']));
            $pool = count($sameKind) >= 2 ? $sameKind : $completed;
            $durations = self::durations($pool);
            $duration = self::weightedMedian($durations, $latest['start']);
            $minutes = (int) round($duration['value']);

            return [
                ...$base,
                'average_sleep_duration_minutes' => $minutes,
                'prediction' => [
                    'type' => 'wake_up',
                    'at' => self::moment($latest['start'])->addMinutes($minutes)->toIso8601String(),
                    'range' => self::usualRange(
                        array_column(array_slice($durations, -self::RANGE_SAMPLE), 'minutes'),
                        $latest['start'],
                        $minutes,
                    ),
                    'based_on' => 'average_sleep_duration',
                ],
            ];
        }

        // Despierto: qué número de ventana del día viene ahora.
        $lastEnd = $latest['end'];
        $lastWindow = $windows === [] ? null : $windows[array_key_last($windows)];
        $nextNumber = $latest['night']
            ? 1
            : (($lastWindow['to_sleep_id'] ?? null) === $latest['id'] && $lastWindow['number'] !== null
                ? $lastWindow['number'] + 1
                : null);

        $sameNumber = $nextNumber !== null
            ? array_values(array_filter($windows, fn (array $w) => $w['number'] === $nextNumber))
            : [];
        $useNumber = $sameNumber !== [] && self::totalWeight($sameNumber, $lastEnd) >= self::MIN_ORDINAL_WEIGHT;
        $pool = $useNumber ? $sameNumber : $windows;

        $prior = $ageReference !== null ? ($ageReference['min'] + $ageReference['max']) / 2 : null;
        $own = $pool !== [] ? self::weightedMedian($pool, $lastEnd, $prior) : null;

        if ($own === null && $prior === null) {
            return $base;
        }

        $minutes = (int) round($own['value'] ?? $prior);
        $basedOn = match (true) {
            $own === null => 'age_reference',
            $useNumber => 'wake_window_by_number',
            default => 'average_wake_window',
        };

        return [
            ...$base,
            'average_wake_window_minutes' => $minutes,
            'window_number' => $useNumber ? $nextNumber : null,
            'prediction' => [
                'type' => 'next_sleep',
                'at' => self::moment($lastEnd)->addMinutes($minutes)->toIso8601String(),
                'range' => self::usualRange(
                    array_column(array_slice($windows, -self::RANGE_SAMPLE), 'minutes'),
                    $lastEnd,
                    $minutes,
                ),
                'based_on' => $basedOn,
            ],
        ];
    }

    /** Un instante (marca de tiempo) como fecha, en la zona de la aplicación. */
    private static function moment(int $timestamp): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestamp($timestamp, (string) config('app.timezone'));
    }

    /**
     * Rango habitual (percentil 20 a 80 de lo observado recientemente),
     * siempre con la hora predicha dentro. Null con pocos datos. Es una
     * forma honesta de mostrar la incertidumbre: en un backtest con datos
     * reales de un recién nacido, la mitad de las veces el resultado cae
     * fuera de cualquier margen estrecho alrededor de la hora puntual.
     *
     * @param  list<int>  $minutes
     * @return array{from: string, to: string}|null
     */
    private static function usualRange(array $minutes, int $originTimestamp, int $pointMinutes): ?array
    {
        $range = Quantiles::usualRange($minutes);
        if ($range === null) {
            return null;
        }

        $origin = self::moment($originTimestamp);

        return [
            'from' => $origin->addMinutes((int) round(min($range['low'], $pointMinutes)))->toIso8601String(),
            'to' => $origin->addMinutes((int) round(max($range['high'], $pointMinutes)))->toIso8601String(),
        ];
    }

    /**
     * Duración de cada sueño terminado, con el instante en que acabó.
     *
     * @param  list<array{id: int, start: int, end: int|null, night: bool}>  $completed
     * @return list<array{minutes: int, at: int}>
     */
    private static function durations(array $completed): array
    {
        return array_map(fn (array $s) => [
            'minutes' => self::minutesBetween($s['start'], (int) $s['end']),
            'at' => (int) $s['end'],
        ], $completed);
    }

    /**
     * Las ventanas (tiempo despierto entre dos sueños seguidos), con su
     * número dentro del día: 1 = la primera tras la noche. Null si no se
     * sabe (no hay noche registrada antes en ese tramo).
     *
     * @param  list<array{id: int, start: int, end: int|null, night: bool}>  $completed
     * @return list<array{minutes: int, at: int, number: int|null, to_sleep_id: int}>
     */
    private static function wakeWindows(array $completed): array
    {
        $windows = [];
        $number = null;

        for ($i = 1; $i < count($completed); $i++) {
            $previous = $completed[$i - 1];
            $next = $completed[$i];
            $gap = self::minutesBetween((int) $previous['end'], $next['start']);

            $number = $previous['night'] ? 1 : ($number !== null ? $number + 1 : null);

            // Despertar de madrugada entre dos tramos de noche: no es
            // una ventana de siesta.
            if ($previous['night'] && $next['night']) {
                $number = null;

                continue;
            }
            if ($gap <= 0 || $gap > self::MAX_WAKE_WINDOW_HOURS * 60) {
                $number = null;

                continue;
            }

            $windows[] = [
                'minutes' => $gap,
                'at' => $next['start'],
                'number' => $number,
                'to_sleep_id' => $next['id'],
            ];
        }

        return $windows;
    }

    private static function isNight(int $timestamp, DateTimeZone $zone): bool
    {
        $hour = (int) (new DateTimeImmutable('@'.$timestamp))->setTimezone($zone)->format('G');

        return $hour >= self::NIGHT_START_HOUR || $hour < self::NIGHT_END_HOUR;
    }

    /** Minutos enteros entre dos marcas de tiempo (truncados hacia cero, como antes). */
    private static function minutesBetween(int $from, int $to): int
    {
        return (int) (($to - $from) / 60);
    }

    /**
     * Media ponderada por recencia respecto a `$reference` (lo más
     * reciente pesa 1, cada día antes un 15 % menos).
     *
     * @param  list<array{minutes: int, at: int}>  $items
     * @return array{value: float, weight: float}
     */
    private static function weightedAverage(array $items, int $reference): array
    {
        $sum = 0.0;
        $weights = 0.0;
        foreach ($items as $item) {
            $weight = self::weight($item['at'], $reference);
            $sum += $item['minutes'] * $weight;
            $weights += $weight;
        }

        return ['value' => $sum / $weights, 'weight' => $weights];
    }

    /**
     * Mediana ponderada por recencia, con la referencia por edad como una
     * observación más (peso AGE_PRIOR_WEIGHT). La mediana, y no la media,
     * porque las ventanas de un bebé son muy asimétricas (muchas cortas y
     * alguna muy larga) y la media se iba hacia esas colas: en un backtest
     * con datos reales acertaba menos que la propia referencia por edad.
     * `weight` es el peso de las observaciones propias (sin la referencia).
     *
     * @param  list<array{minutes: int, at: int}>  $items
     * @return array{value: float, weight: float}
     */
    private static function weightedMedian(array $items, int $reference, ?float $prior = null): array
    {
        $points = [];
        $own = 0.0;
        foreach ($items as $item) {
            $weight = self::weight($item['at'], $reference);
            $points[] = [(float) $item['minutes'], $weight];
            $own += $weight;
        }
        $total = $own;
        if ($prior !== null) {
            $points[] = [$prior, self::AGE_PRIOR_WEIGHT];
            $total += self::AGE_PRIOR_WEIGHT;
        }
        usort($points, fn (array $a, array $b) => $a[0] <=> $b[0]);

        $cumulative = 0.0;
        foreach ($points as [$value, $weight]) {
            $cumulative += $weight;
            if ($cumulative >= $total / 2) {
                return ['value' => $value, 'weight' => $own];
            }
        }

        return ['value' => $points[array_key_last($points)][0], 'weight' => $own];
    }

    /**
     * @param  list<array{minutes: int, at: int}>  $items
     */
    private static function totalWeight(array $items, int $reference): float
    {
        $total = 0.0;
        foreach ($items as $item) {
            $total += self::weight($item['at'], $reference);
        }

        return $total;
    }

    private static function weight(int $at, int $reference): float
    {
        $days = max(0.0, ($reference - $at) / 86400);

        return self::RECENCY_DECAY ** $days;
    }
}
