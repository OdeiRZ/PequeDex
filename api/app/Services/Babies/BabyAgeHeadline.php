<?php

namespace App\Services\Babies;

use App\Models\Baby;
use Carbon\CarbonImmutable;

/**
 * Same headline math as `getBabyAge()`/`heroHeadline` in
 * `lib/babyAge.ts`/`DashboardView.vue` - days while under one month old,
 * weeks after that, or a countdown to the due date for a baby not born
 * yet (Contracciones is reachable precisely then, Estadísticas only
 * once born). Shared by both PDF headers instead of each
 * reimplementing it - it used to live only in StatsExportController,
 * which never had to handle "expecting" at all.
 */
class BabyAgeHeadline
{
    /**
     * @return array{type: 'born'|'expecting'|'unknown', value: int|null, unit: string|null, special: string|null}
     */
    public static function forBaby(Baby $baby): array
    {
        $now = CarbonImmutable::now()->startOfDay();

        if ($baby->birth_date) {
            $birth = CarbonImmutable::parse((string) $baby->birth_date)->startOfDay();

            if ($birth->lte($now)) {
                $days = (int) $birth->diffInDays($now);

                return $now->lt($birth->addMonth())
                    ? self::born($days)
                    : self::bornWeeks(intdiv($days, 7));
            }

            // Un birth_date en el futuro no es un nacimiento real todavía
            // - una fecha elegida de antemano, o una fecha prevista
            // metida en el campo equivocado. Mismo criterio que
            // getBabyAge(): se trata como "a la espera".
            return self::expecting((int) $now->diffInDays($birth));
        }

        if ($baby->due_date) {
            $due = CarbonImmutable::parse((string) $baby->due_date)->startOfDay();

            return self::expecting($due->gte($now) ? (int) $now->diffInDays($due) : 0);
        }

        return ['type' => 'unknown', 'value' => null, 'unit' => null, 'special' => null];
    }

    /**
     * @return array{type: 'born', value: int, unit: string, special: null}
     */
    private static function born(int $days): array
    {
        return ['type' => 'born', 'value' => $days, 'unit' => $days === 1 ? 'día' : 'días', 'special' => null];
    }

    /**
     * @return array{type: 'born', value: int, unit: string, special: null}
     */
    private static function bornWeeks(int $weeks): array
    {
        return ['type' => 'born', 'value' => $weeks, 'unit' => $weeks === 1 ? 'semana' : 'semanas', 'special' => null];
    }

    /**
     * @return array{type: 'expecting', value: int|null, unit: string|null, special: string|null}
     */
    private static function expecting(int $daysUntilDue): array
    {
        if ($daysUntilDue === 0) {
            return ['type' => 'expecting', 'value' => null, 'unit' => null, 'special' => '¡Puede ser hoy!'];
        }

        return [
            'type' => 'expecting',
            'value' => $daysUntilDue,
            'unit' => $daysUntilDue === 1 ? 'día' : 'días',
            'special' => null,
        ];
    }
}
