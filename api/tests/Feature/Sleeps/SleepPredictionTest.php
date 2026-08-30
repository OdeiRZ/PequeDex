<?php

use App\Models\Baby;
use App\Models\Sleep;
use App\Models\User;

function babyForSleepPredictionTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('reports insufficient data with fewer than 3 completed sleeps', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);
    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 08:00:00',
        'ended_at' => '2026-08-30 09:00:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")
        ->assertOk()
        ->assertJsonPath('data.has_enough_data', false)
        ->assertJsonPath('data.prediction', null);
});

it('predicts the next sleep from the average wake window when the last sleep already ended', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    // Four 60-minute naps, each separated by a 120-minute wake window.
    foreach ([['08:00', '09:00'], ['11:00', '12:00'], ['14:00', '15:00'], ['17:00', '18:00']] as [$start, $end]) {
        Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$start}:00",
            'ended_at' => "2026-08-30 {$end}:00",
        ]);
    }

    $response = $this->getJson("/api/babies/{$baby->id}/sleep-prediction");

    $response->assertOk()
        ->assertJsonPath('data.has_enough_data', true)
        ->assertJsonPath('data.average_sleep_duration_minutes', 60)
        ->assertJsonPath('data.average_wake_window_minutes', 120)
        ->assertJsonPath('data.prediction.type', 'next_sleep')
        ->assertJsonPath('data.prediction.based_on', 'average_wake_window');

    expect($response->json('data.prediction.at'))->toContain('2026-08-30T20:00:00');
});

it('predicts the wake-up time from the average duration when a sleep is ongoing', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    foreach ([['08:00', '09:00'], ['11:00', '12:00'], ['14:00', '15:00']] as [$start, $end]) {
        Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$start}:00",
            'ended_at' => "2026-08-30 {$end}:00",
        ]);
    }
    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 20:00:00',
        'ended_at' => null,
    ]);

    $response = $this->getJson("/api/babies/{$baby->id}/sleep-prediction");

    $response->assertOk()
        ->assertJsonPath('data.prediction.type', 'wake_up')
        ->assertJsonPath('data.prediction.based_on', 'average_sleep_duration');

    expect($response->json('data.prediction.at'))->toContain('2026-08-30T21:00:00');
});

it('rejects the sleep prediction for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForSleepPredictionTest($other);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")->assertForbidden();
});
