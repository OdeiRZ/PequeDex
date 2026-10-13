<?php

use App\Models\Baby;
use App\Models\Feed;
use App\Models\Milestone;
use App\Models\Sleep;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

function userWithPassword(string $password = 'mi-contraseña'): User
{
    return User::factory()->create(['password' => Hash::make($password)]);
}

it('refuses to delete the account without the right password', function () {
    $user = userWithPassword();
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->deleteJson('/api/user', [])->assertUnprocessable()->assertJsonValidationErrors('current_password');
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->deleteJson('/api/user', ['current_password' => 'otra'])->assertUnprocessable();

    expect(User::find($user->id))->not->toBeNull();
});

it('deletes the babies only this person looked after, with their data and photos', function () {
    $user = userWithPassword();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    Feed::factory()->create(['baby_id' => $baby->id, 'user_id' => $user->id]);
    Storage::disk('public')->put('milestones/solo/foto.webp', 'x');
    Milestone::factory()->create(['baby_id' => $baby->id, 'user_id' => $user->id, 'photo_path' => 'milestones/solo/foto.webp']);

    $response = $this->withToken($user->createToken('t')->plainTextToken)
        ->deleteJson('/api/user', ['current_password' => 'mi-contraseña']);

    $response->assertOk()->assertJson(['babies_deleted' => 1, 'babies_left' => 0]);
    expect(User::find($user->id))->toBeNull()
        ->and(Baby::find($baby->id))->toBeNull()
        ->and(Feed::count())->toBe(0);
    Storage::disk('public')->assertMissing('milestones/solo/foto.webp');
});

it('keeps a shared baby and everything its author had logged', function () {
    $leaving = userWithPassword();
    $staying = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach([$leaving->id, $staying->id]);
    $feed = Feed::factory()->create(['baby_id' => $baby->id, 'user_id' => $leaving->id]);
    $sleep = Sleep::factory()->create(['baby_id' => $baby->id, 'user_id' => $staying->id]);

    $this->withToken($leaving->createToken('t')->plainTextToken)
        ->deleteJson('/api/user', ['current_password' => 'mi-contraseña'])
        ->assertOk()
        ->assertJson(['babies_deleted' => 0, 'babies_left' => 1]);

    expect(User::find($leaving->id))->toBeNull()
        ->and(Baby::find($baby->id))->not->toBeNull()
        ->and($baby->users()->pluck('users.id')->all())->toBe([$staying->id])
        // Lo anotado por quien se va se queda, sin autor.
        ->and(Feed::find($feed->id))->not->toBeNull()
        ->and(Feed::find($feed->id)->user_id)->toBeNull()
        ->and(Sleep::find($sleep->id)->user_id)->toBe($staying->id);
});

it('removes the sessions of the deleted account', function () {
    $user = userWithPassword();
    $user->createToken('otro-movil');
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->deleteJson('/api/user', ['current_password' => 'mi-contraseña'])->assertOk();

    $this->assertDatabaseCount('personal_access_tokens', 0);
});

it('exports all the data of the account without secrets or other people\'s emails', function () {
    $user = userWithPassword();
    $other = User::factory()->create(['email' => 'otro-cuidador@example.test']);
    $baby = Baby::factory()->create(['name' => 'Violeta']);
    $baby->users()->attach([$user->id, $other->id]);
    Feed::factory()->create(['baby_id' => $baby->id, 'user_id' => $other->id]);
    Sleep::factory()->create(['baby_id' => $baby->id, 'user_id' => $user->id]);
    Storage::disk('public')->put('milestones/x/f.webp', 'x');
    Milestone::factory()->create(['baby_id' => $baby->id, 'user_id' => $user->id, 'title' => 'Primera sonrisa', 'photo_path' => 'milestones/x/f.webp']);

    $response = $this->withToken($user->createToken('t')->plainTextToken)->getJson('/api/user/export');

    $response->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="pequedex-datos.json"')
        ->assertJsonPath('account.email', $user->email)
        ->assertJsonPath('babies.0.baby.name', 'Violeta')
        ->assertJsonPath('babies.0.caregivers', 2)
        ->assertJsonCount(1, 'babies.0.feeds')
        ->assertJsonCount(1, 'babies.0.sleeps')
        ->assertJsonPath('babies.0.milestones.0.title', 'Primera sonrisa')
        ->assertJsonPath('babies.0.milestones.0.has_photo', true);

    $raw = $response->getContent();
    expect($raw)->not->toContain('otro-cuidador@example.test')
        ->and($raw)->not->toContain('"password"')
        ->and($raw)->not->toContain('milestones/x/f.webp')
        ->and($raw)->not->toContain('"user_id"');
});

it('requires authentication to export or delete', function () {
    $this->getJson('/api/user/export')->assertUnauthorized();
    $this->deleteJson('/api/user', ['current_password' => 'x'])->assertUnauthorized();
});
