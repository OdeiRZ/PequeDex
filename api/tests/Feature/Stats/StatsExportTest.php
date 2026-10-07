<?php

use App\Http\Controllers\Stats\StatsExportController;
use App\Models\Baby;
use App\Models\User;

/**
 * The export doesn't query anything itself - it only renders whatever
 * the frontend already computed and posts along (see
 * ExportStatsRequest's own docblock on why: hour-bucket/day-boundary
 * math needs the caregiver's real local timezone, which Laravel has no
 * way to know). This payload is a minimal-but-complete shape matching
 * what `lib/stats.ts` actually produces.
 *
 * @return array<string, mixed>
 */
function validStatsPayload(): array
{
    $emptyBuckets = [
        ['key' => 'dawn', 'value' => 0],
        ['key' => 'morning', 'value' => 0],
        ['key' => 'afternoon', 'value' => 0],
        ['key' => 'night', 'value' => 10],
    ];

    $emptyGrowthMetric = [
        'points' => [],
        'latest_value' => null,
        'latest_percentile' => null,
        'gained' => null,
        'count' => 0,
    ];

    return [
        'sleep' => [
            'has_enough_data' => true,
            'total_completed' => 5,
            'average_duration_minutes' => 45.5,
            'average_wake_window_minutes' => 120.0,
            'by_hour_bucket' => $emptyBuckets,
        ],
        'feed' => [
            'has_enough_data' => true,
            'total' => 10,
            'by_type' => ['pecho' => 6, 'biberon' => 3, 'solido' => 1],
            'pecho_side_counts' => ['izquierdo' => 3, 'derecho' => 3, 'ambos' => 0],
            'average_bottle_amount_ml' => 100.0,
            'average_pecho_duration_minutes' => 15.0,
            'average_gap_minutes' => 180.0,
            'average_per_day' => 2.5,
            'by_hour_bucket' => $emptyBuckets,
        ],
        'diaper' => [
            'has_enough_data' => true,
            'total' => 8,
            'by_type' => ['mojado' => 4, 'sucio' => 2, 'ambos' => 2],
            'by_size' => ['0' => 0, '1' => 3, '2' => 0, '3' => 0, '4' => 0, '5' => 0, '6+' => 0, 'unspecified' => 5],
            'average_per_day' => 2.0,
            'pee_by_hour_bucket' => $emptyBuckets,
            'poop_by_hour_bucket' => $emptyBuckets,
        ],
        'growth' => [
            'weight_kg' => $emptyGrowthMetric,
            'height_cm' => $emptyGrowthMetric,
            'head_circumference_cm' => $emptyGrowthMetric,
        ],
    ];
}

function babyForStatsExportTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('exports stats as a PDF', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $response = $this->postJson("/api/babies/{$baby->id}/stats/export", validStatsPayload());

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('application/pdf');
});

it('rejects exporting stats for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($other);

    $this->postJson("/api/babies/{$baby->id}/stats/export", validStatsPayload())->assertForbidden();
});

it('rejects a malformed payload instead of rendering a broken PDF', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['sleep']['by_hour_bucket'] = [['key' => 'not-a-real-bucket', 'value' => 1]];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['sleep.by_hour_bucket.0.key', 'sleep.by_hour_bucket']);
});

it('rejects unauthenticated access to the export endpoint', function () {
    $baby = Baby::factory()->create();

    $this->postJson("/api/babies/{$baby->id}/stats/export", validStatsPayload())->assertUnauthorized();
});

/**
 * The rest of these test buildViewData() directly, same reasoning as
 * ContractionsExportTest - dompdf's rendered output isn't plain
 * searchable text.
 */
it('reshapes the three growth metrics into a labeled list for the template', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['growthMetrics'])->toHaveCount(3);
    expect($data['growthMetrics'][0]['label'])->toBe('Peso');
    expect($data['growthMetrics'][0]['unit'])->toBe('kg');
    expect($data['growthMetrics'][1]['label'])->toBe('Talla');
    expect($data['growthMetrics'][2]['label'])->toBe('Perímetro craneal');
});

it('passes the baby and sleep/feed/diaper sections through unchanged', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);
    $payload = validStatsPayload();

    $data = app(StatsExportController::class)->buildViewData($baby, $payload);

    expect($data['baby']->is($baby))->toBeTrue();
    expect($data['sleep'])->toBe($payload['sleep']);
    expect($data['feed'])->toBe($payload['feed']);
    expect($data['diaper'])->toBe($payload['diaper']);
});

it('headlines the baby age in days while under one month old', function () {
    $this->travelTo(now()->setTime(12, 0));
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => now()->subDays(10)->toDateString()]);
    $baby->users()->attach($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['babyAge'])->toBe(['value' => 10, 'unit' => 'días']);
});

it('headlines the baby age in weeks once a month has passed', function () {
    $this->travelTo(now()->setTime(12, 0));
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => now()->subWeeks(10)->toDateString()]);
    $baby->users()->attach($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['babyAge'])->toBe(['value' => 10, 'unit' => 'semanas']);
});
