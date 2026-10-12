<?php

namespace App\Services\Support;

/**
 * Percentiles sencillos para los rangos de las predicciones ("suele ser
 * entre las 14:10 y las 15:20"). Interpolación lineal entre valores.
 */
class Quantiles
{
    /** Con menos observaciones que esto no se da rango: sería inventado. */
    public const MIN_FOR_RANGE = 8;

    /** Rango habitual: del percentil 20 al 80 (en un backtest con datos reales cubrió ~52 %). */
    private const RANGE_LOW = 0.20;

    private const RANGE_HIGH = 0.80;

    /**
     * @param  list<int|float>  $values
     */
    public static function percentile(array $values, float $q): float
    {
        sort($values);
        $position = $q * (count($values) - 1);
        $lower = (int) floor($position);
        $upper = (int) ceil($position);

        return $values[$lower] + ($values[$upper] - $values[$lower]) * ($position - $lower);
    }

    /**
     * Rango habitual (percentil 20 a 80) de los valores, o null si hay
     * pocos para que signifique algo.
     *
     * @param  list<int|float>  $values
     * @return array{low: float, high: float}|null
     */
    public static function usualRange(array $values): ?array
    {
        if (count($values) < self::MIN_FOR_RANGE) {
            return null;
        }

        return [
            'low' => self::percentile($values, self::RANGE_LOW),
            'high' => self::percentile($values, self::RANGE_HIGH),
        ];
    }
}
