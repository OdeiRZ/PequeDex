<?php

use App\Models\Baby;
use App\Models\Sleep;
use App\Models\User;
use Carbon\CarbonImmutable;

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

it('predicts the wake-up with the median duration, not dragged by one long sleep', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    // Siestas de 60, 60, 60 y 240 min: la media saldría en ~105, la mediana en 60.
    foreach ([['08:00', '09:00'], ['11:00', '12:00'], ['14:00', '15:00'], ['16:00', '20:00']] as [$start, $end]) {
        Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$start}:00",
            'ended_at' => "2026-08-30 {$end}:00",
        ]);
    }
    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-31 10:00:00',
        'ended_at' => null,
    ]);

    $response = $this->getJson("/api/babies/{$baby->id}/sleep-prediction")->assertOk();

    expect($response->json('data.prediction.at'))->toContain('2026-08-31T11:00:00');
});

/** Un sueño en hora local de Madrid (la API guarda UTC). */
function madridSleep(Baby $baby, User $user, string $start, ?string $end): void
{
    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => CarbonImmutable::parse($start, 'Europe/Madrid')->utc(),
        'ended_at' => $end !== null ? CarbonImmutable::parse($end, 'Europe/Madrid')->utc() : null,
    ]);
}

it('predicts each wake window of the day from the same window on previous days', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    // Tres días iguales: noche 19:30-07:00, primera ventana de 90 min,
    // segunda de 150. Una media global las mezclaría (120).
    foreach (['2026-08-27', '2026-08-28', '2026-08-29'] as $day) {
        $next = CarbonImmutable::parse($day)->addDay()->toDateString();
        madridSleep($baby, $user, "{$day} 19:30", "{$next} 07:00");
        madridSleep($baby, $user, "{$next} 08:30", "{$next} 09:30");
        madridSleep($baby, $user, "{$next} 12:00", "{$next} 13:00");
    }
    madridSleep($baby, $user, '2026-08-30 19:30', '2026-08-31 07:00');

    $first = $this->getJson("/api/babies/{$baby->id}/sleep-prediction?tz=Europe/Madrid")
        ->assertOk()
        ->assertJsonPath('data.prediction.based_on', 'wake_window_by_number')
        ->assertJsonPath('data.window_number', 1)
        ->assertJsonPath('data.average_wake_window_minutes', 90);
    expect(CarbonImmutable::parse($first->json('data.prediction.at'))->setTimezone('Europe/Madrid')->format('H:i'))->toBe('08:30');

    madridSleep($baby, $user, '2026-08-31 08:30', '2026-08-31 09:30');

    $second = $this->getJson("/api/babies/{$baby->id}/sleep-prediction?tz=Europe/Madrid")
        ->assertOk()
        ->assertJsonPath('data.window_number', 2)
        ->assertJsonPath('data.average_wake_window_minutes', 150);
    expect(CarbonImmutable::parse($second->json('data.prediction.at'))->setTimezone('Europe/Madrid')->format('H:i'))->toBe('12:00');
});

it('weights recent days more than older ones', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    // Hace 5 días, ventanas de 60 min; el último día, de 120. Sin
    // recencia, la mediana caería en 60; con ella manda el último día.
    foreach ([['2026-08-20', ['08:00', '10:00', '12:00']], ['2026-08-25', ['08:00', '11:00', '14:00']]] as [$day, $starts]) {
        foreach ($starts as $start) {
            Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
                'started_at' => "{$day} {$start}:00",
                'ended_at' => CarbonImmutable::parse("{$day} {$start}:00")->addHour(),
            ]);
        }
    }

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")
        ->assertOk()
        ->assertJsonPath('data.prediction.based_on', 'average_wake_window')
        ->assertJsonPath('data.average_wake_window_minutes', 120);
});

it('starts from the age reference and blends it with the baby own windows', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);
    // 2 meses: ventana orientativa de 60-120 min (media 90).
    $baby->update(['birth_date' => now()->subMonths(2)->toDateString()]);

    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 08:00:00',
        'ended_at' => '2026-08-30 09:00:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")
        ->assertOk()
        ->assertJsonPath('data.has_enough_data', false)
        ->assertJsonPath('data.age_reference.min', 60)
        ->assertJsonPath('data.prediction.based_on', 'age_reference')
        ->assertJsonPath('data.average_wake_window_minutes', 90);

    // Con una sola ventana propia (150 min), la referencia (peso 2) manda.
    Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 11:30:00',
        'ended_at' => '2026-08-30 12:30:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")
        ->assertOk()
        ->assertJsonPath('data.average_wake_window_minutes', 90);

    // Con tres ventanas propias de 150 min el mismo día (más peso que la
    // referencia), mandan los datos del bebé.
    foreach (['15:00', '18:30'] as $start) {
        Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$start}:00",
            'ended_at' => CarbonImmutable::parse("2026-08-30 {$start}:00")->addMinutes(60),
        ]);
    }

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")
        ->assertOk()
        ->assertJsonPath('data.prediction.based_on', 'average_wake_window')
        ->assertJsonPath('data.average_wake_window_minutes', 150);
});

it('falls back to UTC for an unknown timezone instead of failing', function () {
    $user = actingAsUser();
    $baby = babyForSleepPredictionTest($user);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction?tz=Mars/Olympus")->assertOk();
});

it('rejects the sleep prediction for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForSleepPredictionTest($other);

    $this->getJson("/api/babies/{$baby->id}/sleep-prediction")->assertForbidden();
});
