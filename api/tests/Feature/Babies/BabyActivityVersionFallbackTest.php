<?php

use App\Models\Baby;
use App\Models\Feed;
use Illuminate\Support\Facades\DB;

it('answers in full and without an etag when the fingerprint cannot be computed, instead of failing', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);

    // La consulta de la huella falla (p.ej. una diferencia entre bases de datos).
    DB::partialMock()->shouldReceive('select')->andThrow(new RuntimeException('boom'));

    $timeline = $this->getJson("/api/babies/{$baby->id}/timeline", ['If-None-Match' => '"lo-que-sea"'])->assertOk();
    $bootstrap = $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => '"lo-que-sea"'])->assertOk();

    expect($timeline->headers->has('ETag'))->toBeFalse()
        ->and($timeline->json('data'))->toHaveCount(1)
        ->and($bootstrap->headers->has('ETag'))->toBeFalse()
        ->and($bootstrap->json('timeline.data'))->toHaveCount(1)
        ->and($bootstrap->json('timeline_etag'))->toBeNull();
});
