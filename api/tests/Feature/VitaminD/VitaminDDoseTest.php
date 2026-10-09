<?php

use App\Models\Baby;
use App\Models\User;
use App\Models\VitaminDDose;
use App\Models\VitaminDSchedule;

function babyWithVitaminDScheduleTest(User $user, array $scheduleAttributes = []): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    VitaminDSchedule::factory()->for($baby)->for($user, 'updatedBy')->create([
        'enabled' => true,
        'start_date' => '2026-10-01',
        'end_date' => '2027-10-01',
        ...$scheduleAttributes,
    ]);

    return $baby;
}

it('marks a dose as given for a day within range', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => '2026-10-08',
        'given' => true,
    ])->assertOk()->assertJsonPath('data.given', true)->assertJsonPath('data.date', '2026-10-08');

    $this->assertDatabaseCount('baby_vitamin_d_doses', 1);
});

it('correcting the same day updates the row instead of duplicating it', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", ['date' => '2026-10-08', 'given' => true])->assertOk();
    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", ['date' => '2026-10-08', 'given' => false])->assertOk()
        ->assertJsonPath('data.given', false);

    $this->assertDatabaseCount('baby_vitamin_d_doses', 1);
});

it('rejects a date clearly in the future', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => now()->addDays(2)->toDateString(),
        'given' => true,
    ])->assertUnprocessable()->assertJsonValidationErrors('date');
});

it('accepts "tomorrow" in server UTC terms - the caregiver\'s local today just after midnight', function () {
    // The server runs in UTC; a caregiver's local calendar day can
    // already be ahead of the server's UTC date (e.g. just after local
    // midnight in Madrid). before_or_equal:tomorrow gives a day of
    // slack for exactly this - real bug found live at 00:41 local time.
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => now()->addDay()->toDateString(),
        'given' => true,
    ])->assertOk();
});

it('rejects a date before the schedule start_date', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user, ['start_date' => '2026-10-01']);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => '2026-09-30',
        'given' => true,
    ])->assertUnprocessable()->assertJsonValidationErrors('date');
});

it('rejects marking a dose when the baby has no schedule at all', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => '2026-10-08',
        'given' => true,
    ])->assertUnprocessable()->assertJsonValidationErrors('date');
});

it('caps recent_doses on the schedule endpoint to the last 14 days', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user, ['start_date' => '2026-01-01']);
    VitaminDDose::factory()->for($baby)->for($user, 'loggedBy')->create(['date' => now()->subDays(20)->toDateString(), 'given' => true]);
    VitaminDDose::factory()->for($baby)->for($user, 'loggedBy')->create(['date' => now()->subDays(5)->toDateString(), 'given' => true]);

    $response = $this->getJson("/api/babies/{$baby->id}/vitamin-d-schedule")->assertOk();
    $dates = collect($response->json('recent_doses'))->pluck('date');

    expect($dates)->toContain(now()->subDays(5)->toDateString());
    expect($dates)->not->toContain(now()->subDays(20)->toDateString());
});

it('the full doses list includes doses older than 14 days', function () {
    $user = actingAsUser();
    $baby = babyWithVitaminDScheduleTest($user, ['start_date' => '2026-01-01']);
    VitaminDDose::factory()->for($baby)->for($user, 'loggedBy')->create(['date' => now()->subDays(20)->toDateString(), 'given' => true]);

    $this->getJson("/api/babies/{$baby->id}/vitamin-d-doses")->assertOk()
        ->assertJsonFragment(['date' => now()->subDays(20)->toDateString()]);
});

it('rejects access for a user not linked to the baby', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyWithVitaminDScheduleTest($other);

    $this->putJson("/api/babies/{$baby->id}/vitamin-d-doses", [
        'date' => '2026-10-08',
        'given' => true,
    ])->assertForbidden();

    $this->getJson("/api/babies/{$baby->id}/vitamin-d-doses")->assertForbidden();
});
