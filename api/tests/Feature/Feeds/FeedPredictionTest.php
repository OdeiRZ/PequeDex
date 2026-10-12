<?php

use App\Models\Baby;
use App\Models\Feed;
use App\Models\User;
use Carbon\CarbonImmutable;

function babyForFeedPredictionTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('reports insufficient data with fewer than 3 feeds', function () {
    $user = actingAsUser();
    $baby = babyForFeedPredictionTest($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 08:00:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/feed-prediction")
        ->assertOk()
        ->assertJsonPath('data.has_enough_data', false)
        ->assertJsonPath('data.prediction', null);
});

it('predicts the next feed from the average gap between feeds', function () {
    $user = actingAsUser();
    $baby = babyForFeedPredictionTest($user);

    // Four feeds, each separated by a 180-minute gap.
    foreach (['08:00', '11:00', '14:00', '17:00'] as $time) {
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$time}:00",
        ]);
    }

    $response = $this->getJson("/api/babies/{$baby->id}/feed-prediction");

    $response->assertOk()
        ->assertJsonPath('data.has_enough_data', true)
        ->assertJsonPath('data.average_gap_minutes', 180)
        ->assertJsonPath('data.prediction.type', 'next_feed')
        ->assertJsonPath('data.prediction.based_on', 'average_gap');

    expect($response->json('data.prediction.at'))->toContain('2026-08-30T20:00:00');
});

it('ignores an overnight gap longer than 8 hours when averaging', function () {
    $user = actingAsUser();
    $baby = babyForFeedPredictionTest($user);

    // 08:00 -> 11:00 (3h), 11:00 -> 22:00 (11h, overnight, excluded), 22:00 -> 23:00 (1h).
    // Average of the two 3h/1h gaps that count: 120 minutes.
    foreach (['08:00', '11:00', '22:00', '23:00'] as $time) {
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$time}:00",
        ]);
    }

    $response = $this->getJson("/api/babies/{$baby->id}/feed-prediction");

    $response->assertOk()->assertJsonPath('data.average_gap_minutes', 120);
});

it('uses the median gap, so one long gap does not drag the prediction', function () {
    $user = actingAsUser();
    $baby = babyForFeedPredictionTest($user);

    // Huecos de 60, 60, 60 y 300 min: la media sería 120, la mediana 60.
    foreach (['08:00', '09:00', '10:00', '11:00', '16:00'] as $time) {
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$time}:00",
        ]);
    }

    $this->getJson("/api/babies/{$baby->id}/feed-prediction")
        ->assertOk()
        ->assertJsonPath('data.average_gap_minutes', 60);
});

it('gives a usual range only with enough gaps, and always around the predicted time', function () {
    $user = actingAsUser();
    $baby = babyForFeedPredictionTest($user);

    // Pocos huecos: sin rango.
    foreach (['08:00', '09:00', '10:00', '11:00'] as $time) {
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => "2026-08-30 {$time}:00"]);
    }
    $this->getJson("/api/babies/{$baby->id}/feed-prediction")
        ->assertOk()
        ->assertJsonPath('data.prediction.range', null);

    // Once huecos con variedad: ya hay rango, más ancho que un punto.
    $at = CarbonImmutable::parse('2026-08-30 11:00:00');
    foreach ([30, 90, 60, 120, 45, 150, 60, 75] as $gap) {
        $at = $at->addMinutes($gap);
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => $at]);
    }

    $response = $this->getJson("/api/babies/{$baby->id}/feed-prediction")->assertOk();
    $predicted = CarbonImmutable::parse($response->json('data.prediction.at'));
    $from = CarbonImmutable::parse($response->json('data.prediction.range.from'));
    $to = CarbonImmutable::parse($response->json('data.prediction.range.to'));

    expect($from->lessThanOrEqualTo($predicted))->toBeTrue()
        ->and($to->greaterThanOrEqualTo($predicted))->toBeTrue()
        ->and($to->greaterThan($from))->toBeTrue();
});

it('rejects the feed prediction for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForFeedPredictionTest($other);

    $this->getJson("/api/babies/{$baby->id}/feed-prediction")->assertForbidden();
});
