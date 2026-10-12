<?php

use App\Models\Baby;
use App\Models\Feed;

it('answers a conditional poll with 304 while nothing changed, and with the full list once it does', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    $feed = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);

    $first = $this->getJson("/api/babies/{$baby->id}/timeline")->assertOk();
    $etag = $first->headers->get('ETag');
    expect($etag)->not->toBeEmpty();

    // Sin cambios: 304 y sin cuerpo (también con el prefijo de ETag débil).
    $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => $etag])->assertStatus(304);
    $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => 'W/'.$etag])->assertStatus(304);

    // Crear, editar o borrar cambian la huella.
    $created = Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 09:00:00']);
    $afterCreate = $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => $etag])->assertOk();
    expect($afterCreate->headers->get('ETag'))->not->toBe($etag)
        ->and($afterCreate->json('data'))->toHaveCount(2);

    $etag = $afterCreate->headers->get('ETag');
    $this->travel(2)->seconds();
    $feed->update(['started_at' => '2026-08-30 07:00:00']);
    $afterEdit = $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => $etag])->assertOk();
    expect($afterEdit->headers->get('ETag'))->not->toBe($etag);

    $etag = $afterEdit->headers->get('ETag');
    $created->delete();
    $afterDelete = $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => $etag])->assertOk();
    expect($afterDelete->headers->get('ETag'))->not->toBe($etag)
        ->and($afterDelete->json('data'))->toHaveCount(1);
});

it('does not reuse the etag of the default view for the day view', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);

    $default = $this->getJson("/api/babies/{$baby->id}/timeline")->headers->get('ETag');
    $day = $this->getJson("/api/babies/{$baby->id}/timeline?date=2026-08-30");

    $day->assertOk();
    expect($day->headers->get('ETag'))->not->toBe($default);

    $this->getJson("/api/babies/{$baby->id}/timeline?date=2026-08-30", ['If-None-Match' => $default])->assertOk();
});

it('always includes the full timeline in the bootstrap, even for a conditional request', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);

    $etag = $this->getJson("/api/babies/{$baby->id}/timeline")->headers->get('ETag');

    $bootstrap = $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => $etag])->assertOk();

    expect($bootstrap->json('timeline.data'))->toHaveCount(1);
});
