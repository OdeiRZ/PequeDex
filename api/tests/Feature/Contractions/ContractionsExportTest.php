<?php

use App\Http\Controllers\Contractions\ContractionsExportController;
use App\Models\Baby;
use App\Models\Contraction;
use App\Models\User;

it('exports contractions as a PDF', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:13:00',
        'ended_at' => '2026-09-16 15:13:33',
    ]);

    $response = $this->get("/api/babies/{$baby->id}/contractions/export");

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('application/pdf');
});

it('rejects exporting contractions for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($other);

    $this->get("/api/babies/{$baby->id}/contractions/export")->assertForbidden();
});

/**
 * The rest of these test buildViewData() directly - the array the Blade
 * view is built from - rather than scraping text out of the rendered
 * PDF's compressed content streams, which barryvdh/laravel-dompdf
 * doesn't expose as plain searchable text.
 */
it('numbers rows from the oldest (1) to the newest, newest-first in the groups', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:00:00',
        'ended_at' => '2026-09-16 15:00:20',
    ]);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:10:00',
        'ended_at' => '2026-09-16 15:10:15',
    ]);

    $data = app(ContractionsExportController::class)->buildViewData($baby);

    $rows = $data['groups']->flatten(1);
    expect($rows)->toHaveCount(2);
    expect($rows[0]['number'])->toBe(2)
        ->and($rows[0]['started_at']->format('H:i'))->toBe('15:10')
        ->and($rows[1]['number'])->toBe(1)
        ->and($rows[1]['started_at']->format('H:i'))->toBe('15:00');
});

it('computes average duration and interval, excluding gaps over 60 minutes from the average', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    // 10s and 20s duration -> average 15s. Interval between them is
    // 5 minutes; a third contraction 2 hours later creates a second
    // interval that must not pull the average toward it.
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:00:00',
        'ended_at' => '2026-09-16 15:00:10',
    ]);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:05:00',
        'ended_at' => '2026-09-16 15:05:20',
    ]);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 17:05:00',
        'ended_at' => '2026-09-16 17:05:10',
    ]);

    $data = app(ContractionsExportController::class)->buildViewData($baby);

    expect($data['totalContractions'])->toBe(3);
    expect($data['avgDuration'])->toBe('00:13'); // (10+20+10)/3 = 13.33 -> 13
    expect($data['avgInterval'])->toBe('04:50'); // gap from the first contraction's end (15:00:10) to the second's start (15:05:00) - only this one counts

    $rows = $data['groups']->flatten(1);
    expect($rows[0]['interval'])->toBe('> 60 min'); // the 2h gap, printed but not averaged
});

it('places the water-break marker at its own chronological position among the rows', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['water_broke_at' => '2026-09-16 15:05:00']);
    $baby->users()->attach($user);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:00:00',
        'ended_at' => '2026-09-16 15:00:10',
    ]);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:10:00',
        'ended_at' => '2026-09-16 15:10:10',
    ]);

    $data = app(ContractionsExportController::class)->buildViewData($baby);

    $types = $data['groups']->flatten(1)->pluck('type')->all();
    expect($types)->toBe(['contraction', 'water', 'contraction']);

    $waterRow = $data['groups']->flatten(1)->firstWhere('type', 'water');
    expect($waterRow['at']->format('H:i'))->toBe('15:05');
});

it('omits the water-break marker entirely when the bag has not broken', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['water_broke_at' => null]);
    $baby->users()->attach($user);
    Contraction::factory()->for($baby)->for($user, 'loggedBy')->create([
        'started_at' => '2026-09-16 15:00:00',
    ]);

    $data = app(ContractionsExportController::class)->buildViewData($baby);

    expect($data['groups']->flatten(1)->pluck('type')->all())->toBe(['contraction']);
});
