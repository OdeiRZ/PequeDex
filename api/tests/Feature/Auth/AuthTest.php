<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;

it('registers a new user and returns a usable token', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'Odei',
        'email' => 'odei@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertCreated()
        ->assertJsonPath('user.email', 'odei@example.com')
        ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

    $this->assertDatabaseHas('users', ['email' => 'odei@example.com']);

    $token = $response->json('token');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('email', 'odei@example.com');
});

it('accepts a 6-character password but rejects a 5-character one', function () {
    $short = $this->postJson('/api/register', [
        'name' => 'Odei',
        'email' => 'odei@example.com',
        'password' => 'abcde',
        'password_confirmation' => 'abcde',
    ]);

    $short->assertUnprocessable()->assertJsonValidationErrors('password');

    $minimum = $this->postJson('/api/register', [
        'name' => 'Odei',
        'email' => 'odei@example.com',
        'password' => 'abcdef',
        'password_confirmation' => 'abcdef',
    ]);

    $minimum->assertCreated();
});

it('rejects registration with a mismatched password confirmation', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'Odei',
        'email' => 'odei@example.com',
        'password' => 'password',
        'password_confirmation' => 'something-else',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('password');
});

it('rejects registration with an email already in use', function () {
    User::factory()->create(['email' => 'odei@example.com']);

    $response = $this->postJson('/api/register', [
        'name' => 'Otro',
        'email' => 'odei@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('returns validation messages in Spanish', function () {
    User::factory()->create(['email' => 'odei@example.com']);

    $response = $this->postJson('/api/register', [
        'name' => 'Otro',
        'email' => 'odei@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'El email ya está en uso.');
});

it('logs in an existing user with correct credentials', function () {
    User::factory()->create([
        'email' => 'odei@example.com',
        'password' => bcrypt('correct-password'),
    ]);

    $response = $this->postJson('/api/login', [
        'email' => 'odei@example.com',
        'password' => 'correct-password',
    ]);

    $response->assertOk()->assertJsonStructure(['user', 'token']);
});

it('rejects login with an incorrect password', function () {
    User::factory()->create([
        'email' => 'odei@example.com',
        'password' => bcrypt('correct-password'),
    ]);

    $response = $this->postJson('/api/login', [
        'email' => 'odei@example.com',
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('rejects login for an email that does not exist', function () {
    $response = $this->postJson('/api/login', [
        'email' => 'nadie@example.com',
        'password' => 'whatever',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('logs out and revokes the current token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test-suite')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/logout')
        ->assertNoContent();

    // Sanctum's guard caches the resolved user for the lifetime of the
    // container; within a single test that container is shared across both
    // calls above (unlike separate real requests, which each get a fresh
    // one), so the guard must be reset to prove the token is really revoked.
    Auth::forgetGuards();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/user')
        ->assertUnauthorized();
});

it('rejects unauthenticated access to protected routes', function () {
    $this->getJson('/api/user')->assertUnauthorized();
});

it('returns a clean 401 for an unauthenticated request without an Accept header', function () {
    // getJson() above sends Accept: application/json itself, which never
    // exercised this - Laravel's own default unauthenticated handling only
    // renders JSON when that header is present, and otherwise falls back
    // to redirecting to a named "login" route this app doesn't have,
    // turning into a 500 instead of a 401 (found directly running a plain
    // curl request against the dev server). A plain
    // Http::withToken(...)->get(...) call - no Accept header set - is
    // exactly this case.
    $this->get('/api/user')->assertUnauthorized()->assertJson(['message' => 'Unauthenticated.']);
});
