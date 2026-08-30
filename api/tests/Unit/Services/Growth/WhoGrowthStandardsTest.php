<?php

use App\Services\Growth\WhoGrowthStandards;

it('returns exactly the 50th percentile for a value at the median', function () {
    // WHO's own table: boy, 12 months, weight median (M) is 9.6479 kg.
    $percentile = WhoGrowthStandards::percentile('weight', 'boy', 12, 9.6479);

    expect($percentile)->toBeGreaterThan(49.9)->toBeLessThan(50.1);
});

it('returns a low percentile for a value well below the median', function () {
    $percentile = WhoGrowthStandards::percentile('weight', 'boy', 12, 7.5);

    expect($percentile)->toBeLessThan(5.0);
});

it('returns a high percentile for a value well above the median', function () {
    $percentile = WhoGrowthStandards::percentile('weight', 'boy', 12, 12.0);

    expect($percentile)->toBeGreaterThan(95.0);
});

it('interpolates between whole months for a fractional age', function () {
    // Halfway between month 12 (M=9.6479) and month 13 (M=9.8749): a value
    // right at the interpolated median should still land close to the 50th
    // percentile, not drift toward either whole-month table row.
    $percentile = WhoGrowthStandards::percentile('weight', 'boy', 12.5, 9.76);

    expect($percentile)->toBeGreaterThan(45.0)->toBeLessThan(55.0);
});

it('returns null past the 24-month cutoff this app supports', function () {
    expect(WhoGrowthStandards::percentile('weight', 'boy', 25, 12.0))->toBeNull();
});

it('returns null for a negative age', function () {
    expect(WhoGrowthStandards::percentile('weight', 'boy', -1, 3.5))->toBeNull();
});

it('computes independently for height and head circumference', function () {
    $height = WhoGrowthStandards::percentile('height', 'girl', 6, 65.7);
    $head = WhoGrowthStandards::percentile('head_circumference', 'girl', 6, 42.2);

    expect($height)->not->toBeNull();
    expect($head)->not->toBeNull();
});
