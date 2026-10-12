<?php

namespace App\Services\Vaccinations;

use App\Enums\Region;
use App\Models\Baby;
use Carbon\CarbonImmutable;

/**
 * Las plantillas de vacunas son datos, no código: un fichero por
 * plantilla en resources/vaccination-templates. `comun.php` es la base
 * (calendario del Consejo Interterritorial) y cada comunidad con
 * variaciones tiene su propio fichero que solo dice lo que cambia
 * (`replace`/`add`/`remove`). Una comunidad sin fichero usa el común tal
 * cual - añadir otra es añadir un fichero, sin tocar esta clase.
 */
class VaccinationTemplates
{
    /**
     * @return array{source: string, year: int, region_specific: bool, items: array<int, array{code: string, name: string, months: int, age_label: string, optional?: bool, notes?: string}>}
     */
    public static function forRegion(?Region $region): array
    {
        /** @var array{source: string, year: int, items: array<int, array{code: string, name: string, months: int, age_label: string, optional?: bool, notes?: string}>} $common */
        $common = require self::path('comun');

        $regionFile = $region !== null ? self::path($region->value) : null;
        if ($regionFile === null || ! is_file($regionFile)) {
            return [...$common, 'region_specific' => false];
        }

        /** @var array{source: string, year: int, replace?: array<string, array<string, mixed>>, add?: array<int, array{code: string, name: string, months: int, age_label: string, optional?: bool, notes?: string}>, remove?: array<int, string>} $overrides */
        $overrides = require $regionFile;

        $items = [];
        foreach ($common['items'] as $item) {
            if (in_array($item['code'], $overrides['remove'] ?? [], true)) {
                continue;
            }
            /** @var array{code: string, name: string, months: int, age_label: string, optional?: bool, notes?: string} $merged */
            $merged = [...$item, ...($overrides['replace'][$item['code']] ?? [])];
            $items[] = $merged;
        }
        $items = [...$items, ...($overrides['add'] ?? [])];
        usort($items, fn ($a, $b) => $a['months'] <=> $b['months']);

        return [
            'source' => $overrides['source'],
            'year' => $overrides['year'],
            'region_specific' => true,
            'items' => $items,
        ];
    }

    /**
     * Crea en el bebé las vacunas de su plantilla que todavía no tiene
     * (por `code`), con la fecha prevista desde su fecha de nacimiento
     * (null si no la tiene). Las ya existentes - puestas o no, editadas
     * o no - no se tocan.
     */
    public static function generateFor(Baby $baby): void
    {
        $existing = $baby->vaccinations()->whereNotNull('code')->pluck('code')->all();
        $birth = $baby->birth_date !== null ? CarbonImmutable::parse($baby->birth_date) : null;

        foreach (self::forRegion($baby->region)['items'] as $item) {
            if (in_array($item['code'], $existing, true)) {
                continue;
            }
            $baby->vaccinations()->create([
                'code' => $item['code'],
                'name' => $item['name'],
                'age_label' => $item['age_label'],
                'due_date' => $birth?->addMonthsNoOverflow($item['months'])->toDateString(),
                'optional' => $item['optional'] ?? false,
                'notes' => $item['notes'] ?? null,
            ]);
        }
    }

    /**
     * Al cambiar de comunidad: las vacunas de plantilla todavía sin poner
     * y sin editar se rehacen con la plantilla nueva; las puestas, las
     * editadas y las añadidas a mano se conservan.
     */
    public static function regenerateFor(Baby $baby): void
    {
        $baby->vaccinations()
            ->whereNotNull('code')
            ->whereNull('given_at')
            ->where('edited', false)
            ->delete();
        self::generateFor($baby);
    }

    /**
     * Al cambiar la fecha de nacimiento: rehace la fecha prevista de las
     * vacunas de plantilla todavía sin poner, salvo las que tienen la
     * fecha puesta a mano. Sin fecha de nacimiento, quedan sin fecha.
     */
    public static function recalculateDueDates(Baby $baby): void
    {
        $months = collect(self::forRegion($baby->region)['items'])->pluck('months', 'code');
        $birth = $baby->birth_date !== null ? CarbonImmutable::parse($baby->birth_date) : null;

        $pending = $baby->vaccinations()
            ->whereNotNull('code')
            ->whereNull('given_at')
            ->where('due_date_edited', false)
            ->get();

        foreach ($pending as $vaccination) {
            // Una vacuna editada que ya no está en la plantilla de su
            // comunidad (cambio de comunidad) no tiene edad de referencia.
            if (! $months->has($vaccination->code)) {
                continue;
            }
            $vaccination->update([
                'due_date' => $birth?->addMonthsNoOverflow($months[$vaccination->code])->toDateString(),
            ]);
        }
    }

    private static function path(string $name): string
    {
        return resource_path("vaccination-templates/{$name}.php");
    }
}
