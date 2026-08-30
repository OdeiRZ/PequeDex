<?php

use App\Models\Baby;
use App\Models\GrowthMeasurement;
use App\Models\User;

function babyForGrowthTest(User $user, array $attributes = []): Baby
{
    $baby = Baby::factory()->create($attributes);
    $baby->users()->attach($user);

    return $baby;
}

it('creates a growth measurement with only a weight', function () {
    $user = actingAsUser();
    $baby = babyForGrowthTest($user);

    $this->postJson("/api/babies/{$baby->id}/growth-measurements", [
        'measured_at' => '2026-08-30',
        'weight_grams' => 4200,
    ])->assertCreated()
        ->assertJsonPath('data.weight_grams', 4200)
        ->assertJsonPath('data.height_cm', null);
});

it('rejects a measurement with none of weight/height/head_circumference', function () {
    $user = actingAsUser();
    $baby = babyForGrowthTest($user);

    $this->postJson("/api/babies/{$baby->id}/growth-measurements", [
        'measured_at' => '2026-08-30',
    ])->assertUnprocessable()->assertJsonValidationErrors(['weight_grams', 'height_cm', 'head_circumference_cm']);
});

it('computes WHO percentiles when the baby has a sex and birth date', function () {
    $user = actingAsUser();
    // Born exactly 12 months before the measurement - median boy weight
    // at 12 months is 9647.9g (see WhoGrowthStandards), so a measurement
    // right at that value should land at (very close to) the 50th
    // percentile.
    $baby = babyForGrowthTest($user, ['sex' => 'nino', 'birth_date' => '2025-08-30']);

    $response = $this->postJson("/api/babies/{$baby->id}/growth-measurements", [
        'measured_at' => '2026-08-30',
        'weight_grams' => 9648,
    ]);

    $response->assertCreated();
    expect($response->json('data.weight_percentile'))->toBeGreaterThan(45.0);
    expect($response->json('data.weight_percentile'))->toBeLessThan(55.0);
});

it('leaves percentiles null when the baby has no sex or birth date set', function () {
    $user = actingAsUser();
    $baby = babyForGrowthTest($user); // factory default: no sex, has a birth_date

    $baby->update(['birth_date' => null]);

    $response = $this->postJson("/api/babies/{$baby->id}/growth-measurements", [
        'measured_at' => '2026-08-30',
        'weight_grams' => 4200,
    ]);

    $response->assertCreated()->assertJsonPath('data.weight_percentile', null);
});

it('rejects a measured_at before the baby was born', function () {
    $user = actingAsUser();
    $baby = babyForGrowthTest($user, ['birth_date' => '2026-08-30']);

    $this->postJson("/api/babies/{$baby->id}/growth-measurements", [
        'measured_at' => '2026-08-29',
        'weight_grams' => 3500,
    ])->assertUnprocessable()->assertJsonValidationErrors('measured_at');
});

it('lets a caregiver see and edit a measurement logged by the other caregiver', function () {
    $owner = actingAsUser();
    $baby = babyForGrowthTest($owner);
    $measurement = GrowthMeasurement::factory()->for($baby)->for($owner, 'loggedBy')->create(['weight_grams' => 4000]);

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->putJson("/api/babies/{$baby->id}/growth-measurements/{$measurement->id}", [
        'measured_at' => '2026-08-30',
        'weight_grams' => 4300,
    ])->assertOk()->assertJsonPath('data.weight_grams', 4300);
});

it('deletes a growth measurement', function () {
    $user = actingAsUser();
    $baby = babyForGrowthTest($user);
    $measurement = GrowthMeasurement::factory()->for($baby)->for($user, 'loggedBy')->create();

    $this->deleteJson("/api/babies/{$baby->id}/growth-measurements/{$measurement->id}")->assertNoContent();
    $this->assertDatabaseMissing('growth_measurements', ['id' => $measurement->id]);
});

it('rejects any access to growth measurements for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForGrowthTest($other);

    $this->getJson("/api/babies/{$baby->id}/growth-measurements")->assertForbidden();
});
