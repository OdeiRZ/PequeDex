<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;

it('updates the name and email', function () {
    $user = actingAsUser();

    $this->putJson('/api/user', [
        'name' => 'Nuevo nombre',
        'email' => 'nuevo@example.com',
    ])->assertOk()->assertJsonPath('email', 'nuevo@example.com');

    expect($user->refresh()->name)->toBe('Nuevo nombre');
});

it('rejects an email already used by another user', function () {
    User::factory()->create(['email' => 'ocupado@example.com']);
    actingAsUser();

    $this->putJson('/api/user', [
        'name' => 'Odei',
        'email' => 'ocupado@example.com',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('lets a user keep their own email unchanged', function () {
    $user = actingAsUser();

    $this->putJson('/api/user', [
        'name' => 'Odei',
        'email' => $user->email,
    ])->assertOk();
});

it('updates the password given the correct current one', function () {
    $user = User::factory()->create(['password' => bcrypt('la-antigua')]);
    $this->actingAs($user, 'sanctum');

    $this->putJson('/api/user/password', [
        'current_password' => 'la-antigua',
        'password' => 'la-nueva-1',
        'password_confirmation' => 'la-nueva-1',
    ])->assertNoContent();

    expect(Hash::check('la-nueva-1', $user->refresh()->password))->toBeTrue();
});

it('rejects a password change with the wrong current password', function () {
    $user = User::factory()->create(['password' => bcrypt('la-antigua')]);
    $this->actingAs($user, 'sanctum');

    $this->putJson('/api/user/password', [
        'current_password' => 'no-es-esta',
        'password' => 'la-nueva-1',
        'password_confirmation' => 'la-nueva-1',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
});

it('uploads an avatar and stores it as a data URI', function () {
    $user = actingAsUser();

    $response = $this->postJson('/api/user/avatar', [
        'avatar' => UploadedFile::fake()->image('yo.jpg', 800, 800),
    ]);

    $response->assertOk();
    expect($response->json('avatar'))->toStartWith('data:image/png;base64,');
    expect($user->refresh()->avatar)->toStartWith('data:image/png;base64,');
});

it('rejects a non-image file as the avatar', function () {
    actingAsUser();

    $this->postJson('/api/user/avatar', [
        'avatar' => UploadedFile::fake()->create('documento.pdf', 100),
    ])->assertUnprocessable()->assertJsonValidationErrors('avatar');
});

it('removes the avatar', function () {
    $user = User::factory()->create(['avatar' => 'data:image/png;base64,xyz']);
    $this->actingAs($user, 'sanctum');

    $this->deleteJson('/api/user/avatar')->assertNoContent();
    expect($user->refresh()->avatar)->toBeNull();
});

it('rejects unauthenticated access to profile endpoints', function () {
    $this->putJson('/api/user', ['name' => 'Odei', 'email' => 'odei@example.com'])->assertUnauthorized();
    $this->putJson('/api/user/password', [])->assertUnauthorized();
    $this->postJson('/api/user/avatar', [])->assertUnauthorized();
    $this->deleteJson('/api/user/avatar')->assertUnauthorized();
});
