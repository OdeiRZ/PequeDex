<?php

use App\Models\Baby;
use App\Services\Babies\BabyAgeHeadline;
use Carbon\CarbonImmutable;

it('reports age in days while under one month old', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => now()->subDays(10)->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'born',
        'value' => 10,
        'unit' => 'días',
        'special' => null,
    ]);
});

it('uses the singular unit for exactly one day old', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => now()->subDay()->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'born',
        'value' => 1,
        'unit' => 'día',
        'special' => null,
    ]);
});

it('switches to weeks once a full month has passed', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => now()->subWeeks(10)->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'born',
        'value' => 10,
        'unit' => 'semanas',
        'special' => null,
    ]);
});

it('uses the calendar month rollover, not a flat 30-day proxy', function () {
    // Nacido el 31 de enero - Carbon (y `setMonth()` en JS, mismo
    // comportamiento) desborda un día que el mes siguiente no tiene al
    // mes de después: "un mes" cae el 3 de marzo, no el 28 de febrero
    // ni 30/31 días después. El 2 de marzo sigue dentro del primer mes;
    // el 3 ya no.
    test()->travelTo(CarbonImmutable::parse('2026-01-31')->setTime(12, 0));
    $baby = new Baby(['birth_date' => '2026-01-31']);

    test()->travelTo(CarbonImmutable::parse('2026-03-02')->setTime(12, 0));
    expect(BabyAgeHeadline::forBaby($baby)['unit'])->toBe('días');

    test()->travelTo(CarbonImmutable::parse('2026-03-03')->setTime(12, 0));
    expect(BabyAgeHeadline::forBaby($baby)['unit'])->toBe('semanas');
});

it('counts down to the due date when not born yet', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => null, 'due_date' => now()->addDays(15)->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'expecting',
        'value' => 15,
        'unit' => 'días',
        'special' => null,
    ]);
});

it('special-cases a due date of today instead of "0 días"', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => null, 'due_date' => now()->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'expecting',
        'value' => null,
        'unit' => null,
        'special' => '¡Puede ser hoy!',
    ]);
});

it('clamps a due date already in the past to 0 instead of a negative countdown', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => null, 'due_date' => now()->subDays(3)->toDateString()]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'expecting',
        'value' => null,
        'unit' => null,
        'special' => '¡Puede ser hoy!',
    ]);
});

it('treats a birth_date in the future as an expecting countdown, not a birth', function () {
    test()->travelTo(now()->setTime(12, 0));
    $baby = new Baby(['birth_date' => now()->addDays(20)->toDateString(), 'due_date' => null]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'expecting',
        'value' => 20,
        'unit' => 'días',
        'special' => null,
    ]);
});

it('reports unknown when neither birth_date nor due_date is set', function () {
    $baby = new Baby(['birth_date' => null, 'due_date' => null]);

    expect(BabyAgeHeadline::forBaby($baby))->toBe([
        'type' => 'unknown',
        'value' => null,
        'unit' => null,
        'special' => null,
    ]);
});
