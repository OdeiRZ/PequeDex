<?php

use App\Models\Baby;
use App\Models\DiaperChange;
use App\Models\User;

function babyForDiaperTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('creates a diaper change', function () {
    $user = actingAsUser();
    $baby = babyForDiaperTest($user);

    $this->postJson("/api/babies/{$baby->id}/diaper-changes", [
        'changed_at' => '2026-08-30 10:00:00',
        'type' => 'sucio',
    ])->assertCreated()->assertJsonPath('data.type', 'sucio')->assertJsonPath('data.user_id', $user->id);
});

it('rejects an invalid diaper type', function () {
    $user = actingAsUser();
    $baby = babyForDiaperTest($user);

    $this->postJson("/api/babies/{$baby->id}/diaper-changes", [
        'changed_at' => '2026-08-30 10:00:00',
        'type' => 'no-existe',
    ])->assertUnprocessable()->assertJsonValidationErrors('type');
});

it('rejects a changed_at before the baby was born', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => '2026-08-30']);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/diaper-changes", [
        'changed_at' => '2026-08-29 23:00:00',
        'type' => 'sucio',
    ])->assertUnprocessable()->assertJsonValidationErrors('changed_at');
});

it('lets a caregiver see and edit a diaper change logged by the other caregiver', function () {
    $owner = actingAsUser();
    $baby = babyForDiaperTest($owner);
    $diaperChange = DiaperChange::factory()->for($baby)->for($owner, 'loggedBy')->create();

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->putJson("/api/babies/{$baby->id}/diaper-changes/{$diaperChange->id}", [
        'changed_at' => '2026-08-30 11:00:00',
        'type' => 'ambos',
    ])->assertOk()->assertJsonPath('data.type', 'ambos');
});

it('deletes a diaper change', function () {
    $user = actingAsUser();
    $baby = babyForDiaperTest($user);
    $diaperChange = DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->deleteJson("/api/babies/{$baby->id}/diaper-changes/{$diaperChange->id}")->assertNoContent();
    $this->assertDatabaseMissing('diaper_changes', ['id' => $diaperChange->id]);
});

it('rejects any access to diaper changes for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForDiaperTest($other);

    $this->getJson("/api/babies/{$baby->id}/diaper-changes")->assertForbidden();
});
