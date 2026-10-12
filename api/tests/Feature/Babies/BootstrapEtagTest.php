<?php

use App\Models\Baby;
use App\Models\Checkup;
use App\Models\DiaperChange;
use App\Models\Feed;
use App\Models\GrowthMeasurement;
use App\Models\Milestone;
use App\Models\Sleep;
use App\Models\Temperature;
use App\Models\User;
use App\Models\Vaccination;
use App\Models\VitaminDDose;
use App\Models\VitaminDSchedule;
use Illuminate\Support\Facades\DB;

function babyWithEtag(User $user): Baby
{
    $baby = Baby::factory()->create(['vaccinations_enabled' => true]);
    $baby->users()->attach($user);
    Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 08:00:00']);

    return $baby;
}

it('answers 304 without a body while nothing changed, also with a weak etag', function () {
    $user = actingAsUser();
    $baby = babyWithEtag($user);

    $first = $this->getJson("/api/babies/{$baby->id}/bootstrap")->assertOk();
    $etag = $first->headers->get('ETag');
    expect($etag)->not->toBeEmpty();

    $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => $etag])
        ->assertStatus(304)
        ->assertHeader('ETag', $etag);
    $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => 'W/'.$etag])->assertStatus(304);
});

it('changes the etag when anything the dashboard shows changes', function () {
    $user = actingAsUser();
    $baby = babyWithEtag($user);
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create();
    $schedule = VitaminDSchedule::factory()->for($baby)->create();

    $changes = [
        'a feed' => fn () => Feed::factory()->for($baby)->for($user, 'loggedBy')->create(['started_at' => '2026-08-30 09:00:00']),
        'a sleep' => fn () => Sleep::factory()->for($baby)->for($user, 'loggedBy')->create(),
        'a diaper change' => fn () => DiaperChange::factory()->for($baby)->for($user, 'loggedBy')->create(),
        'a temperature' => fn () => Temperature::factory()->for($baby)->for($user, 'loggedBy')->create(),
        'a growth measurement' => fn () => GrowthMeasurement::factory()->for($baby)->for($user, 'loggedBy')->create(),
        'a milestone' => fn () => Milestone::factory()->for($baby)->for($user, 'loggedBy')->create(),
        'a milestone edit' => fn () => $milestone->update(['title' => 'Otro título']),
        'a like on a milestone' => fn () => $milestone->likedBy()->attach($user->id),
        'a vitamin D schedule edit' => fn () => $schedule->update(['enabled' => ! $schedule->enabled]),
        'a vitamin D dose' => fn () => VitaminDDose::factory()->for($baby)->create(),
        'a vaccination' => fn () => Vaccination::factory()->for($baby)->create(),
        'a checkup' => fn () => Checkup::factory()->for($baby)->create(),
        'the baby itself' => fn () => $baby->update(['name' => 'Nuevo nombre']),
        'a liker avatar' => fn () => $user->setAvatar('data:image/webp;base64,abc'),
    ];

    foreach ($changes as $name => $change) {
        $etag = $this->getJson("/api/babies/{$baby->id}/bootstrap")->headers->get('ETag');
        $this->travel(2)->seconds(); // updated_at tiene resolución de segundos
        $change();

        $after = $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => $etag]);

        expect($after->status())->toBe(200, "no cambió la huella tras {$name}")
            ->and($after->headers->get('ETag'))->not->toBe($etag);
    }
});

it('changes the etag with the time zone and the day of the alerts window, which change the answer', function () {
    $user = actingAsUser();
    $baby = babyWithEtag($user);

    $base = $this->getJson("/api/babies/{$baby->id}/bootstrap?tz=Europe/Madrid&since=2026-10-05T10:00:00Z")->headers->get('ETag');

    // Misma ventana de avisos (mismo día) y misma zona: la misma huella.
    expect($this->getJson("/api/babies/{$baby->id}/bootstrap?tz=Europe/Madrid&since=2026-10-05T23:59:59Z")->headers->get('ETag'))->toBe($base);
    // Otra zona u otro día: otra huella.
    expect($this->getJson("/api/babies/{$baby->id}/bootstrap?tz=UTC&since=2026-10-05T10:00:00Z")->headers->get('ETag'))->not->toBe($base);
    expect($this->getJson("/api/babies/{$baby->id}/bootstrap?tz=Europe/Madrid&since=2026-10-06T10:00:00Z")->headers->get('ETag'))->not->toBe($base);
});

it('changes the etag every half life of the signed photo urls only while there are photos', function () {
    $user = actingAsUser();
    $withoutPhotos = babyWithEtag($user);
    $withPhotos = babyWithEtag($user);
    Milestone::factory()->for($withPhotos)->for($user, 'loggedBy')->create(['photo_path' => 'milestones/1/foto.webp']);

    $this->travelTo(now()->setTime(10, 0));
    $before = [
        $this->getJson("/api/babies/{$withoutPhotos->id}/bootstrap")->headers->get('ETag'),
        $this->getJson("/api/babies/{$withPhotos->id}/bootstrap")->headers->get('ETag'),
    ];

    $this->travel(16)->minutes();
    $after = [
        $this->getJson("/api/babies/{$withoutPhotos->id}/bootstrap")->headers->get('ETag'),
        $this->getJson("/api/babies/{$withPhotos->id}/bootstrap")->headers->get('ETag'),
    ];

    // Sin fotos no caduca nada: sigue valiendo. Con fotos, la URL firmada se renueva.
    expect($after[0])->toBe($before[0])
        ->and($after[1])->not->toBe($before[1]);
});

it('checks "has anything changed" with a single query on top of the permission and the baby', function () {
    $user = actingAsUser();
    $baby = babyWithEtag($user);
    $etag = $this->getJson("/api/babies/{$baby->id}/bootstrap")->headers->get('ETag');

    $queries = [];
    DB::listen(function ($query) use (&$queries) {
        $queries[] = $query->sql;
    });
    $this->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => $etag])->assertStatus(304);

    $versionQueries = array_filter($queries, fn ($sql) => str_contains($sql, 'union all'));
    expect($versionQueries)->toHaveCount(1)
        ->and(count($queries))->toBeLessThanOrEqual(3);
});

it('does not hand a 304 to someone who is not a caregiver of the baby', function () {
    $user = actingAsUser();
    $baby = babyWithEtag($user);
    $etag = $this->getJson("/api/babies/{$baby->id}/bootstrap")->headers->get('ETag');

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson("/api/babies/{$baby->id}/bootstrap", ['If-None-Match' => $etag])
        ->assertForbidden();
});
