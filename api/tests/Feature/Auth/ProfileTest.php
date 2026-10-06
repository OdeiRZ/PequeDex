<?php

use App\Enums\DiaperSize;
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

it('rejects an image whose dimensions are too large to safely decode', function () {
    actingAsUser();

    // A 1px-tall strip is cheap to generate/decode in the test itself
    // (unlike a real decompression bomb), but its width alone already
    // exceeds AvatarProcessor::MAX_SOURCE_DIMENSION - enough to exercise
    // the guard without needing gigabytes of memory in the test run.
    $response = $this->postJson('/api/user/avatar', [
        'avatar' => UploadedFile::fake()->image('enorme.jpg', 8500, 1),
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('avatar');
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

it('updates the action bar categories', function () {
    $user = actingAsUser();

    $this->putJson('/api/user/action-bar', [
        'action_bar_categories' => ['feed', 'diaper', 'growth'],
    ])->assertOk()->assertJsonPath('action_bar_categories', ['feed', 'diaper', 'growth']);

    expect($user->refresh()->action_bar_categories)->toBe(['feed', 'diaper', 'growth']);
});

it('rejects fewer than 3 action bar categories', function () {
    actingAsUser();

    $this->putJson('/api/user/action-bar', [
        'action_bar_categories' => ['feed', 'sleep'],
    ])->assertUnprocessable()->assertJsonValidationErrors('action_bar_categories');
});

it('rejects an unknown action bar category', function () {
    actingAsUser();

    $this->putJson('/api/user/action-bar', [
        'action_bar_categories' => ['feed', 'sleep', 'not-a-real-category'],
    ])->assertUnprocessable()->assertJsonValidationErrors('action_bar_categories.2');
});

it('turns predictions off and back on', function () {
    $user = actingAsUser();

    // Eloquent doesn't repopulate an in-memory model with a column's DB
    // default when the attribute was omitted from create() - only the
    // database row actually has it, so a fresh read is needed here.
    expect($user->refresh()->predictions_enabled)->toBeTrue();

    $this->putJson('/api/user/predictions', ['predictions_enabled' => false])
        ->assertOk()
        ->assertJsonPath('predictions_enabled', false);
    expect($user->refresh()->predictions_enabled)->toBeFalse();

    $this->putJson('/api/user/predictions', ['predictions_enabled' => true])
        ->assertOk()
        ->assertJsonPath('predictions_enabled', true);
    expect($user->refresh()->predictions_enabled)->toBeTrue();
});

it('turns swipe-to-delete on and back off, defaulting to disabled', function () {
    $user = actingAsUser();

    // Same reason as the predictions_enabled test above - the DB default
    // (false here) only lands on a fresh read, not the in-memory model.
    expect($user->refresh()->swipe_to_delete_enabled)->toBeFalse();

    $this->putJson('/api/user/swipe-to-delete', ['swipe_to_delete_enabled' => true])
        ->assertOk()
        ->assertJsonPath('swipe_to_delete_enabled', true);
    expect($user->refresh()->swipe_to_delete_enabled)->toBeTrue();

    $this->putJson('/api/user/swipe-to-delete', ['swipe_to_delete_enabled' => false])
        ->assertOk()
        ->assertJsonPath('swipe_to_delete_enabled', false);
    expect($user->refresh()->swipe_to_delete_enabled)->toBeFalse();
});

it('turns the today-summary cards off and back on, defaulting to enabled', function () {
    $user = actingAsUser();

    // Same reason as the predictions_enabled test above - the DB default
    // (true here) only lands on a fresh read, not the in-memory model.
    expect($user->refresh()->today_summary_enabled)->toBeTrue();

    $this->putJson('/api/user/today-summary', ['today_summary_enabled' => false])
        ->assertOk()
        ->assertJsonPath('today_summary_enabled', false);
    expect($user->refresh()->today_summary_enabled)->toBeFalse();

    $this->putJson('/api/user/today-summary', ['today_summary_enabled' => true])
        ->assertOk()
        ->assertJsonPath('today_summary_enabled', true);
    expect($user->refresh()->today_summary_enabled)->toBeTrue();
});

it('turns interaction feedback (sound/haptics) off and back on, defaulting to enabled', function () {
    $user = actingAsUser();

    // Same reason as the predictions_enabled test above - the DB default
    // (true here) only lands on a fresh read, not the in-memory model.
    expect($user->refresh()->interaction_feedback_enabled)->toBeTrue();

    $this->putJson('/api/user/interaction-feedback', ['interaction_feedback_enabled' => false])
        ->assertOk()
        ->assertJsonPath('interaction_feedback_enabled', false);
    expect($user->refresh()->interaction_feedback_enabled)->toBeFalse();

    $this->putJson('/api/user/interaction-feedback', ['interaction_feedback_enabled' => true])
        ->assertOk()
        ->assertJsonPath('interaction_feedback_enabled', true);
    expect($user->refresh()->interaction_feedback_enabled)->toBeTrue();
});

it('sets and clears a default diaper size, defaulting to none', function () {
    $user = actingAsUser();

    expect($user->refresh()->default_diaper_size)->toBeNull();

    $this->putJson('/api/user/default-diaper-size', ['default_diaper_size' => '3'])
        ->assertOk()
        ->assertJsonPath('default_diaper_size', '3');
    expect($user->refresh()->default_diaper_size)->toBe(DiaperSize::Talla3);

    $this->putJson('/api/user/default-diaper-size', ['default_diaper_size' => null])
        ->assertOk()
        ->assertJsonPath('default_diaper_size', null);
    expect($user->refresh()->default_diaper_size)->toBeNull();
});

it('rejects an invalid default diaper size', function () {
    actingAsUser();

    $this->putJson('/api/user/default-diaper-size', ['default_diaper_size' => 'XL'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('default_diaper_size');
});

it('sets and clears a default feed duration, defaulting to none', function () {
    $user = actingAsUser();

    expect($user->refresh()->default_feed_duration_minutes)->toBeNull();

    $this->putJson('/api/user/default-feed-duration', ['default_feed_duration_minutes' => 20])
        ->assertOk()
        ->assertJsonPath('default_feed_duration_minutes', 20);
    expect($user->refresh()->default_feed_duration_minutes)->toBe(20);

    $this->putJson('/api/user/default-feed-duration', ['default_feed_duration_minutes' => null])
        ->assertOk()
        ->assertJsonPath('default_feed_duration_minutes', null);
    expect($user->refresh()->default_feed_duration_minutes)->toBeNull();
});

it('rejects a default feed duration outside the picker options', function () {
    actingAsUser();

    $this->putJson('/api/user/default-feed-duration', ['default_feed_duration_minutes' => 12])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('default_feed_duration_minutes');
});

it('turns the sounds link off and back on, defaulting to enabled', function () {
    $user = actingAsUser();

    expect($user->refresh()->sounds_enabled)->toBeTrue();

    $this->putJson('/api/user/sounds', ['sounds_enabled' => false])
        ->assertOk()
        ->assertJsonPath('sounds_enabled', false);
    expect($user->refresh()->sounds_enabled)->toBeFalse();

    $this->putJson('/api/user/sounds', ['sounds_enabled' => true])
        ->assertOk()
        ->assertJsonPath('sounds_enabled', true);
    expect($user->refresh()->sounds_enabled)->toBeTrue();
});

it('turns the stats link off and back on, defaulting to enabled', function () {
    $user = actingAsUser();

    expect($user->refresh()->stats_enabled)->toBeTrue();

    $this->putJson('/api/user/stats', ['stats_enabled' => false])
        ->assertOk()
        ->assertJsonPath('stats_enabled', false);
    expect($user->refresh()->stats_enabled)->toBeFalse();

    $this->putJson('/api/user/stats', ['stats_enabled' => true])
        ->assertOk()
        ->assertJsonPath('stats_enabled', true);
    expect($user->refresh()->stats_enabled)->toBeTrue();
});

it('rejects unauthenticated access to profile endpoints', function () {
    $this->putJson('/api/user', ['name' => 'Odei', 'email' => 'odei@example.com'])->assertUnauthorized();
    $this->putJson('/api/user/password', [])->assertUnauthorized();
    $this->postJson('/api/user/avatar', [])->assertUnauthorized();
    $this->deleteJson('/api/user/avatar')->assertUnauthorized();
    $this->putJson('/api/user/action-bar', ['action_bar_categories' => ['feed', 'sleep', 'diaper']])->assertUnauthorized();
    $this->putJson('/api/user/predictions', ['predictions_enabled' => false])->assertUnauthorized();
    $this->putJson('/api/user/swipe-to-delete', ['swipe_to_delete_enabled' => true])->assertUnauthorized();
    $this->putJson('/api/user/today-summary', ['today_summary_enabled' => false])->assertUnauthorized();
    $this->putJson('/api/user/interaction-feedback', ['interaction_feedback_enabled' => false])->assertUnauthorized();
    $this->putJson('/api/user/default-diaper-size', ['default_diaper_size' => '3'])->assertUnauthorized();
    $this->putJson('/api/user/default-feed-duration', ['default_feed_duration_minutes' => 20])->assertUnauthorized();
    $this->putJson('/api/user/sounds', ['sounds_enabled' => false])->assertUnauthorized();
    $this->putJson('/api/user/stats', ['stats_enabled' => false])->assertUnauthorized();
});
