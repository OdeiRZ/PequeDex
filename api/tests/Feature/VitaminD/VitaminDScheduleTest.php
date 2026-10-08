<?php

use App\Models\Baby;
use App\Models\User;
use App\Models\VitaminDSchedule;

function babyForVitaminDTest(User $user, array $attributes = []): Baby
{
    $baby = Baby::factory()->create($attributes);
    $baby->users()->attach($user);

    return $baby;
}

it('activates a vitamin D schedule for the first time', function () {
    $user = actingAsUser();
    $baby = babyForVitaminDTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ])->assertOk()
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.start_date', '2026-10-08')
        ->assertJsonPath('data.end_date', '2027-10-08');

    $this->assertDatabaseCount('baby_vitamin_d_schedules', 1);
});

it('re-editing an existing schedule updates the same row instead of creating a second one', function () {
    $user = actingAsUser();
    $baby = babyForVitaminDTest($user);
    VitaminDSchedule::factory()->for($baby)->for($user, 'updatedBy')->create([
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ]);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2027-01-01',
    ])->assertOk()->assertJsonPath('data.end_date', '2027-01-01');

    $this->assertDatabaseCount('baby_vitamin_d_schedules', 1);
});

it('rejects an end_date before start_date', function () {
    $user = actingAsUser();
    $baby = babyForVitaminDTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2026-10-01',
    ])->assertUnprocessable()->assertJsonValidationErrors('end_date');
});

it('deactivates a schedule while keeping its previous dates', function () {
    $user = actingAsUser();
    $baby = babyForVitaminDTest($user);
    VitaminDSchedule::factory()->for($baby)->for($user, 'updatedBy')->create([
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ]);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => false,
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ])->assertOk()->assertJsonPath('data.enabled', false);

    $this->assertDatabaseHas('baby_vitamin_d_schedules', [
        'baby_id' => $baby->id,
        'enabled' => false,
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ]);
});

it('lets a second caregiver of the same baby see and edit the schedule', function () {
    $owner = actingAsUser();
    $baby = babyForVitaminDTest($owner);
    VitaminDSchedule::factory()->for($baby)->for($owner, 'updatedBy')->create(['start_date' => '2026-10-08', 'end_date' => '2027-10-08']);

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->getJson("/api/babies/{$baby->id}/vitamin-d-schedule")->assertOk()->assertJsonPath('data.start_date', '2026-10-08');

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2027-12-31',
    ])->assertOk()->assertJsonPath('data.end_date', '2027-12-31');
});

it('rejects access for a user not linked to the baby', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForVitaminDTest($other);

    $this->getJson("/api/babies/{$baby->id}/vitamin-d-schedule")->assertForbidden();

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-schedule", [
        'enabled' => true,
        'start_date' => '2026-10-08',
        'end_date' => '2027-10-08',
    ])->assertForbidden();
});
