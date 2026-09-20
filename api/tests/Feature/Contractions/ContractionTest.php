<?php

use App\Models\Baby;
use App\Models\Contraction;
use App\Models\User;

function babyForContractionTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('starts a contraction with no body, defaulting started_at to now', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);

    $response = $this->postJson("/api/babies/{$baby->id}/contractions")
        ->assertCreated()
        ->assertJsonPath('data.ended_at', null)
        ->assertJsonPath('data.intensity', 0)
        ->assertJsonPath('data.user_id', $user->id);

    // assertJsonPath('data.ended_at', null) also passes if the key is
    // simply missing (Arr::get resolves a missing path to null too), so
    // this asserts the key is actually present - it caught a real bug
    // where the frontend's `ended_at === null` check to find the running
    // contraction never matched because the key was absent, not null.
    expect($response->json('data'))->toHaveKey('ended_at');
});

it('accepts a backdated started_at when one is sent', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);

    $this->postJson("/api/babies/{$baby->id}/contractions", ['started_at' => '2026-09-16 15:13:00'])
        ->assertCreated()
        ->assertJsonPath('data.started_at', '2026-09-16T15:13:00.000000Z');
});

it('does not require birth_date to already be set - the whole point of this screen is before birth', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => null]);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/contractions")->assertCreated();
});

it('stops a contraction and sets its intensity via update', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);
    $contraction = Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:13:00',
        'ended_at' => null,
    ]);

    $this->putJson("/api/babies/{$baby->id}/contractions/{$contraction->id}", [
        'started_at' => '2026-09-16 15:13:00',
        'ended_at' => '2026-09-16 15:13:33',
        'intensity' => 1,
    ])->assertOk()
        ->assertJsonPath('data.ended_at', '2026-09-16T15:13:33.000000Z')
        ->assertJsonPath('data.intensity', 1);
});

it('rejects an intensity outside 0-2', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);
    $contraction = Contraction::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->putJson("/api/babies/{$baby->id}/contractions/{$contraction->id}", [
        'started_at' => $contraction->started_at->toDateTimeString(),
        'ended_at' => null,
        'intensity' => 3,
    ])->assertUnprocessable()->assertJsonValidationErrors('intensity');
});

it('deletes a contraction', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);
    $contraction = Contraction::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->deleteJson("/api/babies/{$baby->id}/contractions/{$contraction->id}")->assertNoContent();
    $this->assertDatabaseMissing('contractions', ['id' => $contraction->id]);
});

it('rejects any access to contractions for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForContractionTest($other);

    $this->getJson("/api/babies/{$baby->id}/contractions")->assertForbidden();
    $this->postJson("/api/babies/{$baby->id}/contractions")->assertForbidden();
});

it('lists contractions newest first', function () {
    $user = actingAsUser();
    $baby = babyForContractionTest($user);
    $first = Contraction::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-09-16 15:07:00']);
    $second = Contraction::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-09-16 15:13:00']);

    $this->getJson("/api/babies/{$baby->id}/contractions")
        ->assertOk()
        ->assertJsonPath('data.0.id', $second->id)
        ->assertJsonPath('data.1.id', $first->id);
});
