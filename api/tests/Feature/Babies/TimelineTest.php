<?php

use App\Models\Baby;
use App\Models\DiaperChange;
use App\Models\Feed;
use App\Models\Sleep;

it('merges feeds, sleeps and diaper changes into one chronological list', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $feed = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);
    $sleep = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 09:00:00']);
    $diaperChange = DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => '2026-08-30 10:00:00']);

    $response = $this->getJson("/api/babies/{$baby->id}/timeline");

    $response->assertOk()->assertJsonCount(3, 'data');

    $types = $response->json('data.*.type');
    // Mas reciente primero: pañal (10:00), sueño (09:00), toma (08:00).
    expect($types)->toBe(['diaper_change', 'sleep', 'feed']);
    expect($response->json('data.0.data.id'))->toBe($diaperChange->id);
    expect($response->json('data.1.data.id'))->toBe($sleep->id);
    expect($response->json('data.2.data.id'))->toBe($feed->id);
});

it('rejects the timeline for a baby the user is not linked to', function () {
    actingAsUser();
    $baby = Baby::factory()->create();

    $this->getJson("/api/babies/{$baby->id}/timeline")->assertForbidden();
});

it('caps the timeline at the requested limit', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->count(5)->create();

    $this->getJson("/api/babies/{$baby->id}/timeline?limit=2")
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

it('scopes the timeline to a day (plus the day before, for spanning sleeps), ignoring limit', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $onDay = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);
    // Still returned - the backend deliberately over-fetches by a day so
    // a sleep spanning midnight into the requested day isn't cut off;
    // the frontend (DailyRhythm.vue) does the exact [00:00, 24:00)
    // clipping from there.
    $dayBefore = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-29 08:00:00']);
    $dayAfter = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-31 08:00:00']);

    $response = $this->getJson("/api/babies/{$baby->id}/timeline?date=2026-08-30&limit=1")
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $ids = $response->json('data.*.data.id');
    expect($ids)->toContain($onDay->id);
    expect($ids)->toContain($dayBefore->id);
    expect($ids)->not->toContain($dayAfter->id);
});

it('includes a sleep from the day before that spans into the requested day', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $overnightSleep = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-29 23:00:00',
        'ended_at' => '2026-08-30 06:00:00',
    ]);

    $response = $this->getJson("/api/babies/{$baby->id}/timeline?date=2026-08-30")->assertOk();

    expect($response->json('data.*.data.id'))->toContain($overnightSleep->id);
});
