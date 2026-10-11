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
        'period' => '7d',
        'period_deltas' => [
            'longest_stretch_minutes' => 25.4,
            'total_sleep_minutes' => -70.0,
            'feeds_per_day' => 0.02,
            'pee_per_day' => -0.4,
            'poop_per_day' => null,
        ],
        'sleep' => [
            'has_enough_data' => true,
            'average_duration_minutes' => 45.5,
            'average_wake_window_minutes' => 120.0,
            'average_sleeps_per_day' => 5.3,
            'average_longest_stretch_minutes' => 210.0,
            'by_hour_bucket' => $emptyBuckets,
            'average_night_sleep_minutes' => 480.0,
            'average_day_sleep_minutes' => 40.0,
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
            'by_size' => ['0' => 0, '1' => 3, '2' => 0, '3' => 0, '4' => 0, '5' => 0, '6+' => 0, 'unspecified' => 5],
            'average_per_day' => 2.0,
            'average_pee_per_day' => 1.5,
            'average_poop_per_day' => 1.0,
            'average_gap_minutes' => 165.0,
            'by_hour_bucket' => $emptyBuckets,
            'poop_colors' => ['verde' => 0, 'amarillo' => 3, 'marron' => 0, 'meconio' => 0, 'unspecified' => 1],
            'last_poop_at' => '2026-08-30T10:15:00.000Z',
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
            ['week_start' => '2026-07-27', 'sleep_hours' => 50.0, 'longest_stretch_minutes' => 190.0, 'feed_count' => 20, 'diaper_count' => 15],
            ['week_start' => '2026-08-03', 'sleep_hours' => null, 'longest_stretch_minutes' => null, 'feed_count' => 22, 'diaper_count' => 16],
        ],
        'activity_heatmap' => [
            ['day_of_week' => 0, 'hour' => 22, 'count' => 3],
            ['day_of_week' => 4, 'hour' => 8, 'count' => 1],
        ],
        'vitamin_d' => ['has_schedule' => true, 'given' => 42, 'total_days' => 50],
        'weekly_sleep_by_day' => [
            ['date' => '2026-08-24', 'hours' => 6.5],
            ['date' => '2026-08-25', 'hours' => 0],
            ['date' => '2026-08-26', 'hours' => 8.0],
            ['date' => '2026-08-27', 'hours' => 7.25],
            ['date' => '2026-08-28', 'hours' => 0],
            ['date' => '2026-08-29', 'hours' => 9.0],
            ['date' => '2026-08-30', 'hours' => 5.5],
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

it('accepts null per-day and day/night fields - below the sample threshold, lib/stats.ts sends null', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['sleep']['average_sleeps_per_day'] = null;
    $payload['sleep']['average_longest_stretch_minutes'] = null;
    $payload['sleep']['average_night_sleep_minutes'] = null;
    $payload['sleep']['average_day_sleep_minutes'] = null;
    $payload['sleep']['average_total_sleep_minutes'] = null;
    $payload['sleep']['longest_sleep'] = null;
    $payload['feed']['gap_std_dev_minutes'] = null;
    $payload['diaper']['average_pee_per_day'] = null;
    $payload['diaper']['average_poop_per_day'] = null;
    $payload['diaper']['last_poop_at'] = null;
    $payload['week_comparison'] = null;
    $payload['weekly_trend'][0]['sleep_hours'] = null;

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
});

it('formats the previous-period deltas the same way as the screen', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $notes = app(StatsExportController::class)->buildViewData($baby, validStatsPayload())['deltaNotes'];

    expect($notes)->toBe([
        'longest_stretch_minutes' => '+25min vs. los 7 días anteriores',
        'total_sleep_minutes' => '−1h 10min vs. los 7 días anteriores',
        'feeds_per_day' => 'Sin cambios vs. los 7 días anteriores',
        'pee_per_day' => '−0.4 vs. los 7 días anteriores',
        'poop_per_day' => null,
    ]);
});

it('shows no deltas for the whole history', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['period'] = 'all';
    $payload['period_deltas'] = null;

    $notes = app(StatsExportController::class)->buildViewData($baby, $payload)['deltaNotes'];

    expect(array_filter($notes))->toBe([]);
});

it('renders the temperature section when the payload carries one', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['temperature'] = [
        'count' => 3,
        'high_count' => 1,
        'max' => ['celsius' => 38.4, 'at' => '2026-08-30T03:00:00Z'],
        'latest' => ['celsius' => 37.1, 'at' => '2026-08-30T09:00:00Z'],
    ];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
    expect(app(StatsExportController::class)->buildViewData($baby, $payload)['temperature']['high_count'])->toBe(1);
});

it('renders the vaccinations section when the payload carries one', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['vaccinations'] = [
        'given' => 4,
        'total' => 24,
        'overdue' => 1,
        'given_list' => [['name' => 'Hexavalente (DTPa-VPI-Hib-HB)', 'date' => '2026-10-01']],
        'upcoming_list' => [['name' => 'Meningococo ACWY', 'date' => '2026-12-01'], ['name' => 'Vacuna propia', 'date' => null]],
        'next_checkup' => ['reason' => 'Revisión de los 4 meses', 'at' => '2026-12-01T09:30:00Z'],
    ];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
});

it('rejects more than 5 upcoming vaccines in the export', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['vaccinations'] = [
        'given' => 0, 'total' => 6, 'overdue' => 0, 'given_list' => [],
        'upcoming_list' => array_fill(0, 6, ['name' => 'X', 'date' => null]),
        'next_checkup' => null,
    ];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['vaccinations.upcoming_list']);
});

it('rejects a temperature max missing its date', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['temperature'] = ['count' => 1, 'high_count' => 0, 'max' => ['celsius' => 37.0], 'latest' => null];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['temperature.max.at']);
});

it('rejects an unknown period', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['period'] = '90d';

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['period']);
});

it('labels the period and keeps only the stool colours that were logged', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['periodLabel'])->toBe('Últimos 7 días')
        ->and(collect($data['poopColorRows'])->pluck('count', 'label')->all())
        ->toBe(['Amarillo' => 3, 'Sin indicar' => 1])
        ->and($data['lastPoopSince'])->toBeString();
});

it('summarizes the activity heatmap for the printed PDF, where cells cannot be tapped', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['activity_heatmap'] = [
        ['day_of_week' => 6, 'hour' => 22, 'count' => 4],
        ['day_of_week' => 0, 'hour' => 22, 'count' => 1],
        ['day_of_week' => 0, 'hour' => 8, 'count' => 3],
        ['day_of_week' => 0, 'hour' => 9, 'count' => 2],
    ];

    $summary = app(StatsExportController::class)->buildViewData($baby, $payload)['heatmapSummary'];

    expect($summary['total'])->toBe(10)
        ->and($summary['peak'])->toBe(['day' => 'Domingo', 'hour' => 22, 'count' => 4])
        ->and($summary['busiestDay'])->toBe(['day' => 'Lunes', 'count' => 6])
        ->and($summary['busiestHour'])->toBe(['hour' => 22, 'count' => 5]);
});

it('leaves heatmapSummary null with an empty activity_heatmap', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['activity_heatmap'] = [];

    expect(app(StatsExportController::class)->buildViewData($baby, $payload)['heatmapSummary'])->toBeNull();
});

it('leaves lastPoopSince null when no dirty diaper was ever logged', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['diaper']['last_poop_at'] = null;

    $data = app(StatsExportController::class)->buildViewData($baby, $payload);

    expect($data['lastPoopSince'])->toBeNull();
});

it('accepts an empty weekly_trend/activity_heatmap - a brand new baby with no history yet', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['weekly_trend'] = [];
    $payload['activity_heatmap'] = [];

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)->assertOk();
});

it('rejects a poop_colors missing one of the colours', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    unset($payload['diaper']['poop_colors']['meconio']);

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['diaper.poop_colors.meconio']);
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

it('draws WHO bands behind the growth chart when the baby has a sex and birth date', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);
    $baby->update(['sex' => 'nino', 'birth_date' => '2026-08-01']);

    $payload = validStatsPayload();
    $payload['growth']['weight_kg']['points'] = [['date' => '2026-09-01', 'value' => 4.4, 'percentile' => 50.0]];
    $payload['growth']['weight_kg']['count'] = 1;

    $metric = app(StatsExportController::class)->buildViewData($baby->fresh(), $payload)['growthMetrics'][0];

    // Una sola medición: sin bandas no habría gráfica; con ellas, sí.
    expect($metric['hasReference'])->toBeTrue()
        ->and($metric['chart'])->toStartWith('data:image/svg+xml;base64,')
        ->and(base64_decode(substr($metric['chart'], strlen('data:image/svg+xml;base64,'))))->toContain('stroke-dasharray');
});

it('skips WHO bands without a baby sex', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);
    $baby->update(['sex' => null]);

    $payload = validStatsPayload();
    $payload['growth']['weight_kg']['points'] = [['date' => '2026-09-01', 'value' => 4.4, 'percentile' => null]];
    $payload['growth']['weight_kg']['count'] = 1;

    $metric = app(StatsExportController::class)->buildViewData($baby->fresh(), $payload)['growthMetrics'][0];

    expect($metric['hasReference'])->toBeFalse()
        ->and($metric['chart'])->toBeNull();
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
    expect($data['longestStretchTrendPoints'][0]['value'])->toBe(190.0);
    expect($data['longestStretchTrendPoints'][1]['value'])->toBeNull();
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

it('turns weekly_sleep_by_day into a weekday-labeled point list, 0h days included as real bars', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $data = app(StatsExportController::class)->buildViewData($baby, validStatsPayload());

    expect($data['dailySleepPoints'])->toHaveCount(7);
    expect($data['dailySleepPoints'][0])->toBe(['label' => 'lun.', 'value' => 6.5]);
    expect($data['dailySleepPoints'][1]['value'])->toEqual(0);
});

it('rejects a weekly_sleep_by_day entry missing hours', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    unset($payload['weekly_sleep_by_day'][0]['hours']);

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['weekly_sleep_by_day.0.hours']);
});

it('rejects a malformed weekly_sleep_by_day instead of rendering a broken PDF', function () {
    $user = actingAsUser();
    $baby = babyForStatsExportTest($user);

    $payload = validStatsPayload();
    $payload['weekly_sleep_by_day'][0]['date'] = 'not-a-date';

    $this->postJson("/api/babies/{$baby->id}/stats/export", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['weekly_sleep_by_day.0.date']);
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
