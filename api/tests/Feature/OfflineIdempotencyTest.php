<?php

use App\Models\Baby;
use App\Models\DiaperChange;
use App\Models\Feed;
use App\Models\Sleep;
use App\Models\Temperature;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 * Registro sin conexión: el móvil reintenta un envío con el mismo
 * client_uuid si la respuesta se perdió por el camino. El segundo envío
 * debe devolver el registro ya creado, no duplicarlo.
 */

function babyForOfflineTest(User $user): Baby
{
    $baby = Baby::factory()->create(['birth_date' => '2026-08-01']);
    $baby->users()->attach($user);

    return $baby;
}

dataset('loggable', [
    'feed' => ['feeds', Feed::class, ['type' => 'biberon', 'amount_ml' => 90, 'started_at' => '2026-08-30 10:00:00']],
    'sleep' => ['sleeps', Sleep::class, ['started_at' => '2026-08-30 10:00:00', 'ended_at' => '2026-08-30 11:00:00']],
    'diaper' => ['diaper-changes', DiaperChange::class, ['changed_at' => '2026-08-30 10:00:00', 'type' => 'mojado']],
    'temperature' => ['temperatures', Temperature::class, ['measured_at' => '2026-08-30 10:00:00', 'celsius' => 37.2]],
]);

it('creates once and returns the same record when retried with the same client_uuid', function (string $endpoint, string $model, array $payload) {
    $user = actingAsUser();
    $baby = babyForOfflineTest($user);
    $uuid = (string) Str::uuid();

    $first = $this->postJson("/api/babies/{$baby->id}/{$endpoint}", [...$payload, 'client_uuid' => $uuid])
        ->assertCreated()
        ->assertJsonPath('data.client_uuid', $uuid);

    $this->postJson("/api/babies/{$baby->id}/{$endpoint}", [...$payload, 'client_uuid' => $uuid])
        ->assertOk()
        ->assertJsonPath('data.id', $first->json('data.id'));

    expect($model::count())->toBe(1);
})->with('loggable');

it('still creates normally without a client_uuid', function (string $endpoint, string $model, array $payload) {
    $user = actingAsUser();
    $baby = babyForOfflineTest($user);

    $this->postJson("/api/babies/{$baby->id}/{$endpoint}", $payload)->assertCreated();
    $this->postJson("/api/babies/{$baby->id}/{$endpoint}", $payload)->assertCreated();

    expect($model::count())->toBe(2);
})->with('loggable');

// Dos peticiones con el mismo client_uuid a la vez (el móvil agotó el tiempo de la
// primera y reenvió la alta desde la cola mientras el servidor aún la procesaba):
// las dos ven "no existe" y las dos intentan crear. La que pierde choca con la
// restricción única y antes devolvía un 500 ("duplicate key" en Sentry).
it('answers with the record that won the race instead of failing on the unique key', function (string $endpoint, string $model, array $payload) {
    $user = actingAsUser();
    $baby = babyForOfflineTest($user);
    $uuid = (string) Str::uuid();

    // Justo DESPUÉS de que esta petición compruebe que no existe y ANTES de que
    // empiece a crear, "la otra" (otra conexión, ya confirmada) crea el registro.
    $competing = null;
    DB::listen(function ($query) use (&$competing, $uuid, $baby, $user, $payload, $model) {
        $isLookup = $competing === null
            && str_starts_with(strtolower($query->sql), 'select')
            && str_contains($query->sql, 'client_uuid');

        if ($isLookup) {
            $competing = $model::withoutEvents(fn () => $model::create([
                ...$payload,
                'baby_id' => $baby->id,
                'user_id' => $user->id,
                'client_uuid' => $uuid,
            ]));
        }
    });

    $response = $this->postJson("/api/babies/{$baby->id}/{$endpoint}", [...$payload, 'client_uuid' => $uuid]);

    $response->assertOk()->assertJsonPath('data.id', $competing->id);
    expect($model::count())->toBe(1);
})->with('loggable');

it('rejects a client_uuid that is not a uuid', function () {
    $user = actingAsUser();
    $baby = babyForOfflineTest($user);

    $this->postJson("/api/babies/{$baby->id}/diaper-changes", [
        'changed_at' => '2026-08-30 10:00:00',
        'type' => 'mojado',
        'client_uuid' => 'not-a-uuid',
    ])->assertUnprocessable()->assertJsonValidationErrors('client_uuid');
});
