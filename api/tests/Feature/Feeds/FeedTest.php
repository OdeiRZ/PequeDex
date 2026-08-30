<?php

use App\Models\Baby;
use App\Models\Feed;
use App\Models\User;

function babyFor(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('creates a bottle feed', function () {
    $user = actingAsUser();
    $baby = babyFor($user);

    $response = $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'biberon',
        'amount_ml' => 120,
        'started_at' => '2026-08-30 10:00:00',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.type', 'biberon')
        ->assertJsonPath('data.amount_ml', 120)
        ->assertJsonPath('data.user_id', $user->id);
});

it('creates a breastfeed with a side', function () {
    $user = actingAsUser();
    $baby = babyFor($user);

    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'pecho',
        'side' => 'izquierdo',
        'started_at' => '2026-08-30 10:00:00',
    ])->assertCreated()->assertJsonPath('data.side', 'izquierdo');
});

it('rejects a breastfeed with an amount_ml, and a bottle feed with a side', function () {
    $user = actingAsUser();
    $baby = babyFor($user);

    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'pecho',
        'side' => 'izquierdo',
        'amount_ml' => 100,
        'started_at' => '2026-08-30 10:00:00',
    ])->assertUnprocessable()->assertJsonValidationErrors('amount_ml');

    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'biberon',
        'side' => 'izquierdo',
        'amount_ml' => 100,
        'started_at' => '2026-08-30 10:00:00',
    ])->assertUnprocessable()->assertJsonValidationErrors('side');
});

it('rejects a breastfeed with no side, and a bottle feed with no amount', function () {
    $user = actingAsUser();
    $baby = babyFor($user);

    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'pecho',
        'started_at' => '2026-08-30 10:00:00',
    ])->assertUnprocessable()->assertJsonValidationErrors('side');

    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'biberon',
        'started_at' => '2026-08-30 10:00:00',
    ])->assertUnprocessable()->assertJsonValidationErrors('amount_ml');
});

it('lets a caregiver see and edit a feed logged by the other caregiver', function () {
    $owner = actingAsUser();
    $baby = babyFor($owner);
    $feed = Feed::factory()->for($baby)->for($owner, 'loggedBy')->create(['amount_ml' => 90]);

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->getJson("/api/babies/{$baby->id}/feeds")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $feed->id);

    $this->putJson("/api/babies/{$baby->id}/feeds/{$feed->id}", [
        'type' => 'biberon',
        'amount_ml' => 150,
        'started_at' => '2026-08-30 10:00:00',
    ])->assertOk()->assertJsonPath('data.amount_ml', 150);

    expect($feed->refresh()->user_id)->toBe($owner->id); // el autor original no cambia al editarlo
});

it('deletes a feed', function () {
    $user = actingAsUser();
    $baby = babyFor($user);
    $feed = Feed::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->deleteJson("/api/babies/{$baby->id}/feeds/{$feed->id}")->assertNoContent();
    $this->assertDatabaseMissing('feeds', ['id' => $feed->id]);
});

it('rejects any access to feeds for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyFor($other);
    $feed = Feed::factory()->for($baby)->for($other, 'loggedBy')->create();

    $this->getJson("/api/babies/{$baby->id}/feeds")->assertForbidden();
    $this->postJson("/api/babies/{$baby->id}/feeds", [
        'type' => 'biberon', 'amount_ml' => 100, 'started_at' => '2026-08-30 10:00:00',
    ])->assertForbidden();
    $this->putJson("/api/babies/{$baby->id}/feeds/{$feed->id}", [
        'type' => 'biberon', 'amount_ml' => 100, 'started_at' => '2026-08-30 10:00:00',
    ])->assertForbidden();
    $this->deleteJson("/api/babies/{$baby->id}/feeds/{$feed->id}")->assertForbidden();
});

it('404s when the feed id does not belong to the given baby', function () {
    $user = actingAsUser();
    $baby = babyFor($user);
    $otherBaby = babyFor($user);
    $feed = Feed::factory()->for($otherBaby)->for($user, 'loggedBy')->create();

    $this->putJson("/api/babies/{$baby->id}/feeds/{$feed->id}", [
        'type' => 'biberon', 'amount_ml' => 100, 'started_at' => '2026-08-30 10:00:00',
    ])->assertNotFound();
});
