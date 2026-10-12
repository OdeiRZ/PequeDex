<?php

use App\Models\Baby;
use App\Models\DiaperChange;
use App\Models\Feed;
use App\Models\GrowthMeasurement;
use App\Models\Milestone;
use App\Models\Sleep;
use App\Models\Temperature;
use App\Models\User;
use App\Models\Vaccination;

function bootstrapBaby(User $user, array $attributes = []): Baby
{
    $baby = Baby::factory()->create($attributes);
    $baby->users()->attach($user);

    foreach (['08:00', '10:30', '13:00', '15:20'] as $time) {
        Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => "2026-08-30 {$time}:00"]);
    }
    foreach ([['09:00', '09:40'], ['11:30', '12:15'], ['14:10', '14:50']] as [$start, $end]) {
        Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
            'started_at' => "2026-08-30 {$start}:00",
            'ended_at' => "2026-08-30 {$end}:00",
        ]);
    }
    DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => now()->subHours(2)]);
    Temperature::factory()->for($baby)->for($user, 'loggedBy')->create();
    GrowthMeasurement::factory()->for($baby)->for($user, 'loggedBy')->create();
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create();
    $milestone->likedBy()->attach($user->id);

    return $baby;
}

it('returns every dashboard section exactly as its own endpoint does', function () {
    $user = actingAsUser();
    $baby = bootstrapBaby($user);
    $since = now()->subDays(14)->toIso8601String();

    $bootstrap = $this->getJson("/api/babies/{$baby->id}/bootstrap?tz=Europe/Madrid&since=".urlencode($since))->assertOk();

    $endpoints = [
        'timeline' => "/api/babies/{$baby->id}/timeline",
        'growth_measurements' => "/api/babies/{$baby->id}/growth-measurements",
        'milestones' => "/api/babies/{$baby->id}/milestones",
        'sleep_prediction' => "/api/babies/{$baby->id}/sleep-prediction?tz=Europe/Madrid",
        'feed_prediction' => "/api/babies/{$baby->id}/feed-prediction",
        'vitamin_d_schedule' => "/api/babies/{$baby->id}/vitamin-d-schedule",
        'temperatures' => "/api/babies/{$baby->id}/temperatures",
        'recent_diaper_changes' => "/api/babies/{$baby->id}/diaper-changes?since=".urlencode($since),
    ];

    foreach ($endpoints as $section => $uri) {
        expect($bootstrap->json($section))->toBe($this->getJson($uri)->assertOk()->json(), "sección {$section}");
    }

    // La huella de la línea temporal para que el primer sondeo sea condicional.
    expect($bootstrap->json('timeline_etag'))
        ->toBe($this->getJson("/api/babies/{$baby->id}/timeline")->headers->get('ETag'));

    // No incluye vacunas si no están activadas para el bebé.
    expect($bootstrap->json())->not->toHaveKeys(['vaccinations', 'checkups']);
});

it('includes vaccinations and checkups only when they are enabled', function () {
    $user = actingAsUser();
    $baby = bootstrapBaby($user, ['vaccinations_enabled' => true]);
    Vaccination::factory()->for($baby)->create();

    $bootstrap = $this->getJson("/api/babies/{$baby->id}/bootstrap")->assertOk();

    expect($bootstrap->json('vaccinations'))->toBe($this->getJson("/api/babies/{$baby->id}/vaccinations")->json())
        ->and($bootstrap->json('checkups'))->toBe($this->getJson("/api/babies/{$baby->id}/checkups")->json());
});

it('is much cheaper than the separate requests it replaces', function () {
    $user = actingAsUser();
    $baby = bootstrapBaby($user);

    $count = 0;
    DB::listen(function () use (&$count) {
        $count++;
    });

    $this->getJson("/api/babies/{$baby->id}/bootstrap")->assertOk();
    $bootstrapQueries = $count;

    $count = 0;
    foreach (['timeline', 'growth-measurements', 'milestones', 'sleep-prediction', 'feed-prediction', 'vitamin-d-schedule', 'temperatures', 'diaper-changes'] as $endpoint) {
        $this->getJson("/api/babies/{$baby->id}/{$endpoint}")->assertOk();
    }

    // Una sola autenticación (token + usuario) en vez de una por petición.
    expect($bootstrapQueries)->toBeLessThan($count);
});

it('rejects the bootstrap for a baby the user is not linked to', function () {
    actingAsUser();
    $baby = bootstrapBaby(User::factory()->create());

    $this->getJson("/api/babies/{$baby->id}/bootstrap")->assertForbidden();
});
