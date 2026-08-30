<?php

use App\Models\Baby;
use App\Models\User;

it('creates a baby, attaching the creator as its first caregiver', function () {
    $user = actingAsUser();

    $response = $this->postJson('/api/babies', ['name' => 'Peque', 'due_date' => '2026-09-15']);

    $response->assertCreated()
        ->assertJsonPath('data.name', 'Peque')
        ->assertJsonPath('data.due_date', '2026-09-15')
        ->assertJsonStructure(['data' => ['id', 'invite_code']]);

    $baby = Baby::firstOrFail();
    expect($baby->users->pluck('id'))->toEqual(collect([$user->id]));
    expect($baby->invite_code)->not->toBeEmpty();
});

it('allows creating a baby with no name or due date yet', function () {
    actingAsUser();

    $this->postJson('/api/babies', [])
        ->assertCreated()
        ->assertJsonPath('data.name', null)
        ->assertJsonPath('data.due_date', null);
});

it('lists only the authenticated user\'s own babies', function () {
    $user = actingAsUser();
    $mine = Baby::factory()->create();
    $mine->users()->attach($user);
    Baby::factory()->create(); // de otro usuario

    $response = $this->getJson('/api/babies');

    $response->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);
});

it('joins a baby using its invite code', function () {
    $owner = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($owner);

    $joiner = User::factory()->create();
    $this->actingAs($joiner, 'sanctum');

    $response = $this->postJson('/api/babies/join', ['invite_code' => $baby->invite_code])
        ->assertOk()
        ->assertJsonPath('data.id', $baby->id);

    // Not just the DB write - the response body itself must include the
    // caregiver who just joined, not a stale pre-join list (found live:
    // $baby->users was already lazy-loaded by an earlier check in the
    // controller, before attach() ran).
    expect(collect($response->json('data.users'))->pluck('id')->sort()->values())
        ->toEqual(collect([$owner->id, $joiner->id])->sort()->values());

    expect($baby->refresh()->users->pluck('id')->sort()->values())
        ->toEqual(collect([$owner->id, $joiner->id])->sort()->values());
});

it('rejects joining with an invite code that does not exist', function () {
    actingAsUser();

    $this->postJson('/api/babies/join', ['invite_code' => 'NOPE0000'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('invite_code');
});

it('does not duplicate the pivot when joining a baby already joined', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $this->postJson('/api/babies/join', ['invite_code' => $baby->invite_code])->assertOk();

    expect($baby->users()->count())->toBe(1);
});

it('lets a linked caregiver view the baby', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $this->getJson("/api/babies/{$baby->id}")->assertOk()->assertJsonPath('data.id', $baby->id);
});

it('rejects viewing a baby the user is not linked to', function () {
    actingAsUser();
    $baby = Baby::factory()->create();

    $this->getJson("/api/babies/{$baby->id}")->assertForbidden();
});

it('lets a linked caregiver regenerate the invite code', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    $originalCode = $baby->invite_code;

    $response = $this->postJson("/api/babies/{$baby->id}/invite-code");

    $response->assertOk();
    expect($response->json('data.invite_code'))->not->toBe($originalCode);
});

it('rejects regenerating the invite code for a baby the user is not linked to', function () {
    actingAsUser();
    $baby = Baby::factory()->create();

    $this->postJson("/api/babies/{$baby->id}/invite-code")->assertForbidden();
});
