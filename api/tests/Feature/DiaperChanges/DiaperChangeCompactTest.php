<?php

use App\Models\Baby;
use App\Models\DiaperChange;

it('returns only what the dashboard alerts need, with the same values and format as the full list', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    foreach (['2026-08-30 10:00:00' => 'mojado', '2026-08-30 12:30:00' => 'sucio', '2026-08-29 23:15:00' => 'ambos'] as $at => $type) {
        DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => $at, 'type' => $type, 'notes' => 'no debe salir', 'size' => 2]);
    }

    $full = $this->getJson("/api/babies/{$baby->id}/diaper-changes")->assertOk()->json('data');
    $compact = $this->getJson("/api/babies/{$baby->id}/diaper-changes?compact=1")->assertOk()->json('data');

    expect($compact)->toHaveCount(3);
    foreach ($compact as $i => $row) {
        // Mismas filas, mismo orden y exactamente los mismos valores...
        expect($row['id'])->toBe($full[$i]['id'])
            ->and($row['baby_id'])->toBe($full[$i]['baby_id'])
            ->and($row['changed_at'])->toBe($full[$i]['changed_at'])
            ->and($row['type'])->toBe($full[$i]['type']);
        // ...pero solo esas cuatro columnas.
        expect(array_keys($row))->toBe(['id', 'baby_id', 'changed_at', 'type']);
    }
});

it('applies the since filter in compact mode too', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => '2026-08-01 10:00:00']);
    DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => '2026-08-30 10:00:00']);

    $compact = $this->getJson("/api/babies/{$baby->id}/diaper-changes?compact=1&since=2026-08-20")->assertOk()->json('data');

    expect($compact)->toHaveCount(1);
});

it('keeps the full list as the default, for the stats page', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(['changed_at' => '2026-08-30 10:00:00', 'size' => 3]);

    $row = $this->getJson("/api/babies/{$baby->id}/diaper-changes")->assertOk()->json('data.0');

    expect($row)->toHaveKeys(['id', 'user_id', 'size', 'notes', 'created_at']);
});
