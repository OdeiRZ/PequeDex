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
        'weekly_rate' => null,
        'count' => 0,
    ];

    return [
        'sleep' => [
            'has_enough_data' => true,
            'total_completed' => 5,
            'average_duration_minutes' => 45.5,
            'average_wake_window_minutes' => 120.0,
            'by_hour_bucket' => $emptyBuckets,
            'typical_bedtime' => ['hours' => 21, 'minutes' => 30],
            'typical_wake_time' => ['hours' => 7, 'minutes' => 0],
            'average_night_sleep_minutes' => 480.0,
            'average_nap_minutes' => 40.0,
            'average_total_sleep_minutes' => 520.0,
            'longest_sleep' => ['minutes' => 480, 'date' => '2026-08-07T22:00:00.000Z'],
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
            'gap_std_dev_minutes' => 25.0,
        ],
        'diaper' => [
            'has_enough_data' => true,
            'total' => 8,
            'by_type' => ['mojado' => 4, 'sucio' => 2, 'ambos' => 2],
            'by_size' => ['0' => 0, '1' => 3, '2' => 0, '3' => 0, '4' => 0, '5' => 0, '6+' => 0, 'unspecified' => 5],
            'average_per_day' => 2.0,
            'average_wet_per_day' => 1.5,
            'pee_by_hour_bucket' => $emptyBuckets,
            'poop_by_hour_bucket' => $emptyBuckets,
        ],
        'growth' => [
            'weight_kg' => $emptyGrowthMetric,
            'height_cm' => $emptyGrowthMetric,
            'head_circumference_cm' => $emptyGrowthMetric,
        ],
        'week_comparison' => [
            'sleep_hours' => ['current' => 52.0, 'delta' => 3.5],
            'feed_count' => ['current' => 48, 'delta' => -2],
            'diaper_count' => ['current' => 40, 'delta' => 1],
        ],
        'weekly_trend' => [
            ['week_start' => '2026-07-27', 'sleep_hours' => 50.0, 'feed_count' => 20, 'diaper_count' => 15],
            ['week_start' => '2026-08-03', 'sleep_hours' => null, 'feed_count' => 22, 'diaper_count' => 16],
        ],
        'activity_heatmap' => [
            ['day_of_week' => 0, 'hour' => 22, 'count' => 3],
            ['day_of_week' => 4, 'hour' => 8, 'count' => 1],
        ],
        'vitamin_d' => ['has_schedule' => true, 'given' => 42, 'total_days' => 50],
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

it('accepts null typical-time and day/night fields - below the sample threshold, lib/stats.ts sends null', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['sleep']['typical_bedtime'] = null;
    $payload['sleep']['typical_wake_time'] = null;
    $payload['sleep']['average_night_sleep_minutes'] = null;
    $payload['sleep']['average_nap_minutes'] = null;
    $payload['sleep']['average_total_sleep_minutes'] = null;
    $payload['sleep']['longest_sleep'] = null;
    $payload['feed']['gap_std_dev_minutes'] = null;
    $payload['diaper']['average_wet_per_day'] = null;
    $payload['week_comparison'] = null;
    $payload['weekly_trend'][0]['sleep_hours'] = null;

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
});

it('accepts an empty weekly_trend/activity_heatmap - a brand new baby with no history yet', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['weekly_trend'] = [];
    $payload['activity_heatmap'] = [];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
});

it('rejects an hour outside 0-23 in a typical-time field', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['sleep']['typical_bedtime'] = ['hours' => 24, 'minutes' => 0];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['sleep.typical_bedtime.hours']);
});

it('rejects a typical-time field missing its minutes', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    unset($payload['sleep']['typical_wake_time']['minutes']);

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['sleep.typical_wake_time.minutes']);
});

it('rejects a longest_sleep missing its date', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    unset($payload['sleep']['longest_sleep']['date']);

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['sleep.longest_sleep.date']);
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

it('turns weekly_trend into a labeled point list per metric, keeping null sleep weeks as null', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['sleepTrendPoints'])->toHaveCount(2);
    expect($data['sleepTrendPoints'][0]['value'])->toBe(50.0);
    expect($data['sleepTrendPoints'][1]['value'])->toBeNull();
    expect($data['feedTrendPoints'][0])->toBe(['label' => '27 jul.', 'value' => 20]);
    expect($data['diaperTrendPoints'][1])->toBe(['label' => '3 ago.', 'value' => 16]);
});

it('reshapes the flat activity_heatmap list into a dense 7x24 grid', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['heatmapGrid'])->toHaveCount(7);
    expect($data['heatmapGrid'][0])->toHaveCount(24);
    expect($data['heatmapGrid'][0][22])->toBe(3);
    expect($data['heatmapGrid'][4][8])->toBe(1);
    expect($data['heatmapGrid'][1][0])->toBe(0);
    expect($data['heatmapMax'])->toBe(3);
});

it('defaults heatmapMax to 0 with an empty activity_heatmap', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);
    $payload = validStatsPayload();
    $payload['activity_heatmap'] = [];

    $data = app(StatsExportController::class)->buildViewData($baby, $payload);

    expect($data['heatmapMax'])->toBe(0);
});

it('passes vitamin_d through unchanged, same as the other sections', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['vitaminD'])->toBe(['has_schedule' => true, 'given' => 42, 'total_days' => 50]);
});

it('rejects a vitamin_d missing has_schedule', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    unset($payload['vitamin_d']['has_schedule']);

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['vitamin_d.has_schedule']);
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
    expect($data['weekComparison'])->toBe($payload['week_comparison']);
});

it('defaults weekComparison to null when the payload omits it', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);
    $payload = validStatsPayload();
    $payload['week_comparison'] = null;

    $data = app(StatsExportController::class)->buildViewData($baby, $payload);

    expect($data['weekComparison'])->toBeNull();
});

it('headlines the baby age in days while under one month old', function () {
    $this->travelTo(now()->setTime(12, 0));
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => now()->subDays(10)->toDateString()]);
    $baby->users()->attach($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['babyAge'])->toBe([
        'type' => 'born',
        'value' => 10,
        'unit' => 'días',
        'special' => null,
    ]);
});

it('headlines the baby age in weeks once a month has passed', function () {
    $this->travelTo(now()->setTime(12, 0));
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => now()->subWeeks(10)->toDateString()]);
    $baby->users()->attach($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['babyAge'])->toBe([
        'type' => 'born',
        'value' => 10,
        'unit' => 'semanas',
        'special' => null,
    ]);
});
