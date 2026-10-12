<?php

use App\Services\Support\Quantiles;

it('interpolates percentiles linearly', function () {
    expect(Quantiles::percentile([10, 20, 30, 40], 0.5))->toBe(25.0)
        ->and(Quantiles::percentile([40, 10, 30, 20], 0.0))->toBe(10.0)
        ->and(Quantiles::percentile([40, 10, 30, 20], 1.0))->toBe(40.0)
        ->and(Quantiles::percentile([60], 0.8))->toBe(60.0);
});

it('gives the 20-80 range only with enough values', function () {
    expect(Quantiles::usualRange([10, 20, 30]))->toBeNull();

    $range = Quantiles::usualRange([30, 60, 60, 60, 60, 60, 60, 90, 120]);

    expect($range['low'])->toBe(60.0)
        ->and(round($range['high'], 1))->toBe(72.0);
});
