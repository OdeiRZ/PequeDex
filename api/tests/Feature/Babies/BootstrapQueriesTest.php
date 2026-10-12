<?php

use App\Models\Baby;
use App\Models\User;
use Illuminate\Support\Facades\DB;

it('checks the baby permission once per request, not once per dashboard section', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $permissionQueries = 0;
    DB::listen(function ($query) use (&$permissionQueries) {
        if (str_contains($query->sql, 'baby_user') && str_contains($query->sql, 'exists')) {
            $permissionQueries++;
        }
    });

    $this->getJson("/api/babies/{$baby->id}/bootstrap")->assertOk();

    // Antes: una por sección (10). Ahora: una por la petición entera.
    expect($permissionQueries)->toBe(1);
});

it('does not remember a permission across different requests', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create();

    // Sin estar vinculado: prohibido.
    $this->getJson("/api/babies/{$baby->id}/timeline")->assertForbidden();

    // Se vincula y la siguiente petición ya lo ve (no hay caché entre peticiones).
    $baby->users()->attach($user);
    $this->getJson("/api/babies/{$baby->id}/timeline")->assertOk();

    // Y a otro usuario no vinculado se le sigue negando.
    $other = User::factory()->create();
    $this->actingAs($other, 'sanctum')->getJson("/api/babies/{$baby->id}/timeline")->assertForbidden();
});
