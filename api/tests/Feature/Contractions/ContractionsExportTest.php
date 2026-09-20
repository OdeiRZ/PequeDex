<?php

use App\Models\Baby;
use App\Models\Contraction;
use App\Models\User;

it('exports contractions as a PDF', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:13:00',
        'ended_at' => '2026-09-16 15:13:33',
    ]);

    $response = $this->get("/api/babies/{$baby->id}/contractions/export");

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('application/pdf');
});

it('rejects exporting contractions for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($other);

    $this->get("/api/babies/{$baby->id}/contractions/export")->assertForbidden();
});
