<?php

use App\Models\Baby;
use App\Models\Feed;
use App\Models\User;

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

it('rejects the feed prediction for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForFeedPredictionTest($other);

    $this->getJson("/api/babies/{$baby->id}/feed-prediction")->assertForbidden();
});
