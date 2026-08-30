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
