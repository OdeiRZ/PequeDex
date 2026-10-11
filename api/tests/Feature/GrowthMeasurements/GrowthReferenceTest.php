<?php

use App\Models\Baby;
use App\Models\User;
use App\Services\Growth\WhoGrowthStandards;

function babyForGrowthReferenceTest(User $user, array $attributes = []): Baby
{
    $baby = Baby::factory()->create($attributes);
    $baby->users()->attach($user);

    return $baby;
}

it('returns WHO reference curves for the baby sex, month by month 0-24', function () {
    $user = actingAsUser();
    $baby = babyForGrowthReferenceTest($user, ['sex' => 'nina', 'birth_date' => '2026-09-01']);

    $response = $this->getJson("/api/babies/{$baby->id}/growth-reference")->assertOk();

    $weight = $response->json('data.curves.weight');
    expect($weight)->toHaveCount(25)
        ->and($weight[0]['month'])->toBe(0)
        // La mediana (p50) es exactamente M de la tabla de niñas.
        ->and($weight[0]['p50'])->toEqual(3.232)
        ->and($weight[12]['p50'])->toEqual(8.948)
        ->and($weight[0]['p3'])->toBeLessThan($weight[0]['p15'])
        ->and($weight[0]['p85'])->toBeLessThan($weight[0]['p97']);
    expect($response->json('data.curves.height'))->toHaveCount(25);
    expect($response->json('data.curves.head_circumference'))->toHaveCount(25);
});

it('returns null curves when the baby has no sex set', function () {
    $user = actingAsUser();
    $baby = babyForGrowthReferenceTest($user, ['sex' => null]);

    $this->getJson("/api/babies/{$baby->id}/growth-reference")
        ->assertOk()
        ->assertJsonPath('data.curves', null);
});

it('forbids reading the curves of a baby the user is not linked to', function () {
    actingAsUser();
    $baby = Baby::factory()->create(['sex' => 'nino']);

    $this->getJson("/api/babies/{$baby->id}/growth-reference")->assertForbidden();
});

it('round-trips valueAt() through percentile()', function () {
    $value = WhoGrowthStandards::valueAt('height', 'boy', 6.5, WhoGrowthStandards::REFERENCE_PERCENTILES['p85']);

    expect(WhoGrowthStandards::percentile('height', 'boy', 6.5, $value))->toEqualWithDelta(85.0, 0.1);
});
