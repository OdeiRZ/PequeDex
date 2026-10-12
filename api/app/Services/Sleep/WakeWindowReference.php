<?php

namespace App\Services\Sleep;

use App\Models\Baby;
use Carbon\CarbonImmutable;

/**
 * Ventana de sueño orientativa por edad (tiempo despierto entre sueños),
 * en minutos. Misma tabla que `web/src/lib/sleepReference.ts` - si se
 * cambia una, cambiar la otra. No hay tabla oficial (la AAP no publica
 * ninguna): son los rangos de la Cleveland Clinic, revisados por una
 * pediatra. Sin referencia a partir de los 12 meses.
 */
class WakeWindowReference
{
    /** Límite superior excluyente en meses => [min, max] en minutos. */
    private const TABLE = [
        [1, 30, 60],
        [3, 60, 120],
        [5, 75, 150],
        [7, 120, 240],
        [10, 150, 270],
        [12.5, 180, 360],
    ];

    /**
     * @return array{min: int, max: int}|null
     */
    public static function forBaby(Baby $baby, ?CarbonImmutable $now = null): ?array
    {
        if ($baby->birth_date === null) {
            return null;
        }

        $now ??= CarbonImmutable::now();
        // Mes medio de 30,4375 días, como en el frontend y los percentiles.
        $months = CarbonImmutable::parse($baby->birth_date)->diffInDays($now, absolute: false) / 30.4375;
        if ($months < 0) {
            return null;
        }

        foreach (self::TABLE as [$below, $min, $max]) {
            if ($months < $below) {
                return ['min' => $min, 'max' => $max];
            }
        }

        return null;
    }
}
