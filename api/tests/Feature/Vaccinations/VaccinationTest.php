<?php

use App\Enums\Region;
use App\Models\Baby;
use App\Models\Checkup;
use App\Models\User;
use App\Models\Vaccination;
use App\Services\Vaccinations\VaccinationTemplates;

function babyForVaccinationTest(User $user, array $attributes = []): Baby
{
    $baby = Baby::factory()->create(['birth_date' => '2026-08-01', ...$attributes]);
    $baby->users()->attach($user);

    return $baby;
}

it('uses the common calendar for a region without its own template', function () {
    $template = VaccinationTemplates::forRegion(Region::Madrid);

    expect($template['region_specific'])->toBeFalse()
        ->and(collect($template['items'])->firstWhere('code', 'men_4m')['name'])->toBe('Meningococo C');
});

it('swaps MenC for MenACWY at 4 and 12 months in Cantabria', function () {
    $items = collect(VaccinationTemplates::forRegion(Region::Cantabria)['items']);

    expect($items->firstWhere('code', 'men_4m')['name'])->toBe('Meningococo ACWY')
        ->and($items->firstWhere('code', 'men_12m')['name'])->toBe('Meningococo ACWY')
        ->and($items->count())->toBe(count(VaccinationTemplates::forRegion(null)['items']));
});

it('generates the calendar with due dates from the birth date when enabled', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);

    $response = $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", [
        'vaccinations_enabled' => true,
        'region' => 'cantabria',
    ])->assertOk()
        ->assertJsonPath('baby.region', 'cantabria')
        ->assertJsonPath('baby.vaccinations_enabled', true)
        ->assertJsonPath('template.region_specific', true);

    $hexa = collect($response->json('data'))->firstWhere('code', 'hexa_2m');
    expect($hexa['due_date'])->toBe('2026-10-01')
        ->and(collect($response->json('data'))->firstWhere('code', 'hb_birth')['optional'])->toBeTrue();
});

it('does not duplicate the calendar when settings are saved again', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $payload = ['vaccinations_enabled' => true, 'region' => 'madrid'];

    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", $payload)->assertOk();
    $count = $baby->vaccinations()->count();
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", $payload)->assertOk();

    expect($baby->vaccinations()->count())->toBe($count);
});

it('rebuilds pending template vaccines on a region change, keeping given and custom ones', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'madrid']);

    $baby->vaccinations()->where('code', 'hexa_2m')->update(['given_at' => '2026-10-02']);
    $custom = Vaccination::factory()->for($baby)->create(['name' => 'Vacuna propia', 'code' => null]);

    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'cantabria'])->assertOk();

    expect($baby->vaccinations()->where('code', 'men_4m')->value('name'))->toBe('Meningococo ACWY')
        ->and($baby->vaccinations()->where('code', 'hexa_2m')->value('given_at')?->toDateString())->toBe('2026-10-02')
        ->and($baby->vaccinations()->whereKey($custom->id)->exists())->toBeTrue()
        ->and($baby->vaccinations()->where('code', 'hexa_2m')->count())->toBe(1);
});

it('keeps edited pending template vaccines on a region change', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'madrid']);
    $men = $baby->vaccinations()->where('code', 'men_4m')->first();

    $this->putJson("/api/babies/{$baby->id}/vaccinations/{$men->id}", [
        'name' => $men->name,
        'due_date' => $men->due_date->toDateString(),
        'notes' => 'Pedir cita en el centro de salud',
    ])->assertOk()->assertJsonPath('data.edited', true)->assertJsonPath('data.due_date_edited', false);

    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'cantabria'])->assertOk();

    expect($baby->vaccinations()->whereKey($men->id)->value('notes'))->toBe('Pedir cita en el centro de salud')
        ->and($baby->vaccinations()->where('code', 'men_4m')->count())->toBe(1)
        // Las no editadas sí se rehacen con la plantilla nueva.
        ->and($baby->vaccinations()->where('code', 'men_12m')->value('name'))->toBe('Meningococo ACWY');
});

it('does not count marking a vaccine as given as an edit', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'madrid']);
    $hexa = $baby->vaccinations()->where('code', 'hexa_2m')->first();

    $this->putJson("/api/babies/{$baby->id}/vaccinations/{$hexa->id}", [
        'name' => $hexa->name,
        'due_date' => $hexa->due_date->toDateString(),
        'given_at' => '2026-10-02',
        'notes' => null,
    ])->assertOk()->assertJsonPath('data.edited', false)->assertJsonPath('data.due_date_edited', false);
});

it('recalculates pending due dates when the birth date changes, except hand-set ones', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'madrid']);

    $baby->vaccinations()->where('code', 'hexa_2m')->update(['given_at' => '2026-10-02']);
    $men = $baby->vaccinations()->where('code', 'men_4m')->first();
    $this->putJson("/api/babies/{$baby->id}/vaccinations/{$men->id}", [
        'name' => $men->name,
        'due_date' => '2026-12-15',
        'notes' => null,
    ])->assertOk()->assertJsonPath('data.due_date_edited', true);

    $this->putJson("/api/babies/{$baby->id}", ['birth_date' => '2026-08-11'])->assertOk();

    $dates = $baby->vaccinations()->whereNotNull('code')->pluck('due_date', 'code')->map->toDateString();
    expect($dates['hexa_4m'])->toBe('2026-12-11')
        // Puesta: su fecha prevista ya no importa y no se toca.
        ->and($dates['hexa_2m'])->toBe('2026-10-01')
        // Fecha puesta a mano: se respeta.
        ->and($dates['men_4m'])->toBe('2026-12-15');
});

it('keeps everything when disabled', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => null]);
    $count = $baby->vaccinations()->count();

    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => false, 'region' => null])
        ->assertOk()
        ->assertJsonPath('baby.vaccinations_enabled', false);

    expect($baby->vaccinations()->count())->toBe($count);
});

it('marks a vaccine as given and adds a custom one', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $vaccination = Vaccination::factory()->for($baby)->create();

    $this->putJson("/api/babies/{$baby->id}/vaccinations/{$vaccination->id}", [
        'name' => $vaccination->name,
        'due_date' => '2026-10-01',
        'given_at' => '2026-10-03',
        'notes' => 'Lote AB123',
    ])->assertOk()->assertJsonPath('data.given_at', '2026-10-03')->assertJsonPath('data.notes', 'Lote AB123');

    $this->postJson("/api/babies/{$baby->id}/vaccinations", [
        'name' => 'Gripe',
        'given_at' => '2026-10-10',
    ])->assertCreated()->assertJsonPath('data.code', null);
});

it('rejects a given date before birth or in the future', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);

    $this->postJson("/api/babies/{$baby->id}/vaccinations", ['name' => 'X', 'given_at' => '2026-07-01'])
        ->assertUnprocessable()->assertJsonValidationErrors('given_at');
    $this->postJson("/api/babies/{$baby->id}/vaccinations", ['name' => 'X', 'given_at' => now()->addDays(3)->toDateString()])
        ->assertUnprocessable()->assertJsonValidationErrors('given_at');
});

it('deletes a vaccine', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);
    $vaccination = Vaccination::factory()->for($baby)->create();

    $this->deleteJson("/api/babies/{$baby->id}/vaccinations/{$vaccination->id}")->assertNoContent();
    $this->assertDatabaseMissing('vaccinations', ['id' => $vaccination->id]);
});

it('creates, lists, updates and deletes checkups, future dates included', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);

    $id = $this->postJson("/api/babies/{$baby->id}/checkups", [
        'scheduled_at' => now()->addWeek()->toDateTimeString(),
        'reason' => 'Revisión de los 4 meses',
    ])->assertCreated()->json('data.id');

    $this->getJson("/api/babies/{$baby->id}/checkups")->assertOk()->assertJsonCount(1, 'data');
    $this->putJson("/api/babies/{$baby->id}/checkups/{$id}", [
        'scheduled_at' => now()->addWeeks(2)->toDateTimeString(),
        'reason' => 'Revisión de los 4 meses',
        'notes' => 'Llevar cartilla',
    ])->assertOk()->assertJsonPath('data.notes', 'Llevar cartilla');
    $this->deleteJson("/api/babies/{$baby->id}/checkups/{$id}")->assertNoContent();
    expect(Checkup::count())->toBe(0);
});

it('rejects any access for a baby the user is not linked to', function () {
    actingAsUser();
    $baby = babyForVaccinationTest(User::factory()->create());

    $this->getJson("/api/babies/{$baby->id}/vaccinations")->assertForbidden();
    $this->getJson("/api/babies/{$baby->id}/checkups")->assertForbidden();
    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true])->assertForbidden();
});

it('rejects an unknown region', function () {
    $user = actingAsUser();
    $baby = babyForVaccinationTest($user);

    $this->putJson("/api/babies/{$baby->id}/vaccinations/settings", ['vaccinations_enabled' => true, 'region' => 'atlantida'])
        ->assertUnprocessable()->assertJsonValidationErrors('region');
});
