<?php

namespace App\Services\Sleep;

use App\Models\Baby;
use App\Models\Sleep;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

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
 */
class SleepPatternPredictor
{
    private const MIN_SAMPLE_SIZE = 3;

    /** Días de historial considerados (con muchos sueños al día, bastan). */
    private const LOOKBACK_DAYS = 14;

    private const MAX_SLEEPS = 120;

    /** Más largo que esto no es una ventana entre sueños, sino un hueco en el registro. */
    private const MAX_WAKE_WINDOW_HOURS = 6;

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

        // Los 14 días anteriores al último sueño registrado (no a hoy:
        // unos días sin registrar no deben dejarlo sin historial).
        /** @var Collection<int, Sleep> $recent */
        $recent = $baby->sleeps()
            ->orderByDesc('started_at')
            ->limit(self::MAX_SLEEPS)
            ->get();
        $newestStart = $recent->first() !== null ? CarbonImmutable::parse($recent->first()->started_at) : null;
        $sleeps = $recent
            ->filter(fn (Sleep $s) => $newestStart === null
                || CarbonImmutable::parse($s->started_at)->greaterThanOrEqualTo($newestStart->subDays(self::LOOKBACK_DAYS)))
            ->sortBy('started_at')
            ->values();

        $completed = $sleeps->filter(fn (Sleep $sleep) => $sleep->ended_at !== null)->values();
        $ageReference = WakeWindowReference::forBaby($baby, $now);
        $windows = self::wakeWindows($completed, $timezone);

        $base = [
            'has_enough_data' => $completed->count() >= self::MIN_SAMPLE_SIZE,
            'sample_size' => $completed->count(),
            'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
            'average_sleep_duration_minutes' => null,
            'average_wake_window_minutes' => null,
            'window_number' => null,
            'age_reference' => $ageReference,
            'prediction' => null,
        ];

        $latest = $sleeps->last();
        if ($latest === null) {
            return $base;
        }

        if ($base['has_enough_data']) {
            $base['average_sleep_duration_minutes'] = (int) round(self::weightedAverage(
                $completed->map(fn (Sleep $s) => [
                    'minutes' => self::minutesBetween($s->started_at, $s->ended_at),
                    'at' => CarbonImmutable::parse($s->ended_at),
                ]),
                CarbonImmutable::parse($completed->last()->ended_at),
            )['value']);
        }

        // Dormido ahora mismo: cuánto suele durar un sueño de ese tipo
        // (noche o siesta), con la mediana ponderada por recencia (en el
        // backtest, mejor que la media sobre todo en siestas). El campo
        // sigue llamándose `average_...` por compatibilidad con la app.
        if ($latest->ended_at === null) {
            if (! $base['has_enough_data']) {
                return $base;
            }
            $isNight = self::isNight($latest, $timezone);
            $sameKind = $completed->filter(fn (Sleep $s) => self::isNight($s, $timezone) === $isNight);
            $pool = $sameKind->count() >= 2 ? $sameKind : $completed;
            $duration = self::weightedMedian($pool->map(fn (Sleep $s) => [
                'minutes' => self::minutesBetween($s->started_at, $s->ended_at),
                'at' => CarbonImmutable::parse($s->ended_at),
            ]), CarbonImmutable::parse($latest->started_at));

            return [
                ...$base,
                'average_sleep_duration_minutes' => (int) round($duration['value']),
                'prediction' => [
                    'type' => 'wake_up',
                    'at' => CarbonImmutable::parse($latest->started_at)->addMinutes((int) round($duration['value']))->toIso8601String(),
                    'based_on' => 'average_sleep_duration',
                ],
            ];
        }

        // Despierto: qué número de ventana del día viene ahora.
        $lastEnd = CarbonImmutable::parse($latest->ended_at);
        $nextNumber = self::isNight($latest, $timezone)
            ? 1
            : (($windows->last()['to_sleep_id'] ?? null) === $latest->id && $windows->last()['number'] !== null
                ? $windows->last()['number'] + 1
                : null);

        $sameNumber = $nextNumber !== null ? $windows->where('number', $nextNumber) : collect();
        $useNumber = $sameNumber->isNotEmpty() && self::totalWeight($sameNumber, $lastEnd) >= self::MIN_ORDINAL_WEIGHT;
        $pool = $useNumber ? $sameNumber : $windows;

        $prior = $ageReference !== null ? ($ageReference['min'] + $ageReference['max']) / 2 : null;
        $own = $pool->isNotEmpty() ? self::weightedMedian($pool, $lastEnd, $prior) : null;

        if ($own === null && $prior === null) {
            return $base;
        }

        $minutes = $own['value'] ?? $prior;
        $basedOn = match (true) {
            $own === null => 'age_reference',
            $useNumber => 'wake_window_by_number',
            default => 'average_wake_window',
        };

        return [
            ...$base,
            'average_wake_window_minutes' => (int) round($minutes),
            'window_number' => $useNumber ? $nextNumber : null,
            'prediction' => [
                'type' => 'next_sleep',
                'at' => $lastEnd->addMinutes((int) round($minutes))->toIso8601String(),
                'based_on' => $basedOn,
            ],
        ];
    }

    /**
     * Las ventanas (tiempo despierto entre dos sueños seguidos), con su
     * número dentro del día: 1 = la primera tras la noche. Null si no se
     * sabe (no hay noche registrada antes en ese tramo).
     *
     * @param  Collection<int, Sleep>  $completed
     * @return Collection<int, array{minutes: int, at: CarbonImmutable, number: int|null, to_sleep_id: int}>
     */
    private static function wakeWindows(Collection $completed, string $timezone): Collection
    {
        $windows = collect();
        $number = null;

        for ($i = 1; $i < $completed->count(); $i++) {
            $previous = $completed[$i - 1];
            $next = $completed[$i];
            $previousNight = self::isNight($previous, $timezone);
            $gap = self::minutesBetween($previous->ended_at, $next->started_at);

            $number = $previousNight ? 1 : ($number !== null ? $number + 1 : null);

            // Despertar de madrugada entre dos tramos de noche: no es
            // una ventana de siesta.
            if ($previousNight && self::isNight($next, $timezone)) {
                $number = null;

                continue;
            }
            if ($gap <= 0 || $gap > self::MAX_WAKE_WINDOW_HOURS * 60) {
                $number = null;

                continue;
            }

            $windows->push([
                'minutes' => $gap,
                'at' => CarbonImmutable::parse($next->started_at),
                'number' => $number,
                'to_sleep_id' => $next->id,
            ]);
        }

        return $windows;
    }

    private static function isNight(Sleep $sleep, string $timezone): bool
    {
        $hour = CarbonImmutable::parse($sleep->started_at)->setTimezone($timezone)->hour;

        return $hour >= self::NIGHT_START_HOUR || $hour < self::NIGHT_END_HOUR;
    }

    private static function minutesBetween(mixed $from, mixed $to): int
    {
        return (int) CarbonImmutable::parse($from)->diffInMinutes(CarbonImmutable::parse($to), absolute: false);
    }

    /**
     * Media ponderada por recencia respecto a `$reference` (lo más
     * reciente pesa 1, cada día antes un 15 % menos).
     *
     * @param  iterable<array{minutes: int, at: CarbonImmutable}>  $items
     * @return array{value: float, weight: float}
     */
    private static function weightedAverage(iterable $items, CarbonImmutable $reference): array
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
     * @param  iterable<array{minutes: int, at: CarbonImmutable}>  $items
     * @return array{value: float, weight: float}
     */
    private static function weightedMedian(iterable $items, CarbonImmutable $reference, ?float $prior = null): array
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
     * @param  iterable<array{minutes: int, at: CarbonImmutable}>  $items
     */
    private static function totalWeight(iterable $items, CarbonImmutable $reference): float
    {
        $total = 0.0;
        foreach ($items as $item) {
            $total += self::weight($item['at'], $reference);
        }

        return $total;
    }

    private static function weight(CarbonImmutable $at, CarbonImmutable $reference): float
    {
        $days = max(0.0, $at->diffInMinutes($reference, absolute: false) / 1440);

        return self::RECENCY_DECAY ** $days;
    }
}
