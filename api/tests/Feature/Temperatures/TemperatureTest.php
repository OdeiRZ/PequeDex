<?php

use App\Models\Baby;
use App\Models\Temperature;
use App\Models\User;

function babyForTemperatureTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

it('creates a temperature with a method', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-30 10:00:00',
        'celsius' => 38.2,
        'method' => 'axila',
    ])->assertCreated()
        ->assertJsonPath('data.celsius', 38.2)
        ->assertJsonPath('data.method', 'axila')
        ->assertJsonPath('data.user_id', $user->id);
});

it('allows a temperature with no method', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-30 10:00:00',
        'celsius' => 36.7,
    ])->assertCreated()->assertJsonPath('data.method', null);
});

it('rejects a temperature outside 34-43 °C - almost always a typo', function (float $celsius) {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-30 10:00:00',
        'celsius' => $celsius,
    ])->assertUnprocessable()->assertJsonValidationErrors('celsius');
})->with([3.7, 33.9, 43.1]);

it('rejects an unknown method', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-30 10:00:00',
        'celsius' => 37,
        'method' => 'boca',
    ])->assertUnprocessable()->assertJsonValidationErrors('method');
});

it('rejects a measured_at in the future', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => now()->addDay()->toDateTimeString(),
        'celsius' => 37,
    ])->assertUnprocessable()->assertJsonValidationErrors('measured_at');
});

it('rejects a measured_at before the baby was born', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => '2026-08-30']);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-29 23:00:00',
        'celsius' => 37,
    ])->assertUnprocessable()->assertJsonValidationErrors('measured_at');
});

it('lists, updates and deletes temperatures', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);
    $temperature = Temperature::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->getJson("/api/babies/{$baby->id}/temperatures")->assertOk()->assertJsonCount(1, 'data');

    $this->putJson("/api/babies/{$baby->id}/temperatures/{$temperature->id}", [
        'measured_at' => '2026-08-30 11:00:00',
        'celsius' => 37.9,
        'method' => 'recto',
    ])->assertOk()->assertJsonPath('data.celsius', 37.9)->assertJsonPath('data.method', 'recto');

    $this->deleteJson("/api/babies/{$baby->id}/temperatures/{$temperature->id}")->assertNoContent();
    $this->assertDatabaseMissing('temperatures', ['id' => $temperature->id]);
});

it('rejects any access to temperatures for a baby the user is not linked to', function () {
    actingAsUser();
    $baby = babyForTemperatureTest(User::factory()->create());

    $this->getJson("/api/babies/{$baby->id}/temperatures")->assertForbidden();
    $this->postJson("/api/babies/{$baby->id}/temperatures", [
        'measured_at' => '2026-08-30 10:00:00',
        'celsius' => 37,
    ])->assertForbidden();
});

it('includes temperatures in the timeline', function () {
    $user = actingAsUser();
    $baby = babyForTemperatureTest($user);
    $temperature = Temperature::factory()->for($baby)->for($user, 'loggedBy')->create(['measured_at' => '2026-08-30 12:00:00']);

    $this->getJson("/api/babies/{$baby->id}/timeline")
        ->assertOk()
        ->assertJsonPath('data.0.type', 'temperature')
        ->assertJsonPath('data.0.data.id', $temperature->id);

    $this->getJson("/api/babies/{$baby->id}/timeline?date=2026-08-30")
        ->assertOk()
        ->assertJsonPath('data.0.type', 'temperature');
});

it('accepts temperature as an action bar category', function () {
    actingAsUser();

    $this->putJson('/api/user/action-bar', [
        'action_bar_categories' => ['feed', 'sleep', 'diaper', 'temperature'],
    ])->assertOk();
});
