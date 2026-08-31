<?php

use App\Models\Baby;
use App\Models\Sleep;
use App\Models\User;

function babyForSleepTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('creates an ongoing sleep, with no ended_at yet', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);

    $this->postJson("/api/babies/{$baby->id}/sleeps", ['started_at' => '2026-08-30 20:00:00'])
        ->assertCreated()
        ->assertJsonPath('data.ended_at', null)
        ->assertJsonPath('data.user_id', $user->id);
});

it('rejects an ended_at before started_at', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);

    $this->postJson("/api/babies/{$baby->id}/sleeps", [
        'started_at' => '2026-08-30 20:00:00',
        'ended_at' => '2026-08-30 19:00:00',
    ])->assertUnprocessable()->assertJsonValidationErrors('ended_at');
});

it('rejects a started_at before the baby was born', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => '2026-08-30']);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/sleeps", ['started_at' => '2026-08-29 23:00:00'])
        ->assertUnprocessable()->assertJsonValidationErrors('started_at');
});

it('lets a caregiver end a nap the other caregiver started', function () {
    $owner = actingAsUser();
    $baby = babyForSleepTest($owner);
    $sleep = Sleep::factory()->for($baby)->for($owner, 'loggedBy')->create(['started_at' => '2026-08-30 14:00:00', 'ended_at' => null]);

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->putJson("/api/babies/{$baby->id}/sleeps/{$sleep->id}", [
        'started_at' => '2026-08-30 14:00:00',
        'ended_at' => '2026-08-30 15:30:00',
    ])->assertOk()->assertJsonPath('data.ended_at', '2026-08-30T15:30:00.000000Z');
});

it('deletes a sleep', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);
    $sleep = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->deleteJson("/api/babies/{$baby->id}/sleeps/{$sleep->id}")->assertNoContent();
    $this->assertDatabaseMissing('sleeps', ['id' => $sleep->id]);
});

it('rejects any access to sleeps for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForSleepTest($other);

    $this->getJson("/api/babies/{$baby->id}/sleeps")->assertForbidden();
    $this->postJson("/api/babies/{$baby->id}/sleeps", ['started_at' => '2026-08-30 20:00:00'])->assertForbidden();
});

it('filters by since, excluding sleeps that finished before it', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);
    $old = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-20 10:00:00',
        'ended_at' => '2026-08-20 11:00:00',
    ]);
    $recent = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-30 10:00:00',
        'ended_at' => '2026-08-30 11:00:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleeps?since=2026-08-25")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $recent->id);

    expect(Sleep::find($old->id))->not->toBeNull();
});

it('includes an ongoing sleep in the since filter regardless of when it started', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);
    $ongoing = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-01 22:00:00',
        'ended_at' => null,
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleeps?since=2026-08-25")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $ongoing->id);
});

it('includes a sleep that started before since but ended after it', function () {
    $user = actingAsUser();
    $baby = babyForSleepTest($user);
    $overnight = Sleep::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-08-24 23:00:00',
        'ended_at' => '2026-08-25 06:00:00',
    ]);

    $this->getJson("/api/babies/{$baby->id}/sleeps?since=2026-08-25")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $overnight->id);
});
