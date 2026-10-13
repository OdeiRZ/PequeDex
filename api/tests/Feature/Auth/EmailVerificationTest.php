<?php

use App\Models\Baby;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/** El enlace del correo, tal como lo recibiría la persona. */
function verificationLinkFor(User $user): string
{
    $url = (new VerifyEmailNotification)->toMail($user)->actionUrl;
    expect($url)->toStartWith(rtrim((string) config('app.frontend_url'), '/').'/verify-email?');

    return $url;
}

/** La ruta del API a la que la SPA reenvía los parámetros del enlace. */
function apiPathFromLink(string $link): string
{
    parse_str((string) parse_url($link, PHP_URL_QUERY), $q);

    return "/api/email/verify/{$q['id']}/{$q['hash']}?expires={$q['expires']}&signature={$q['signature']}";
}

it('confirms the email with the signed link, without being logged in', function () {
    $user = User::factory()->unverified()->create();

    $this->getJson(apiPathFromLink(verificationLinkFor($user)))->assertOk();

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('rejects a link with a tampered hash or signature, and an expired one', function () {
    $user = User::factory()->unverified()->create();
    $path = apiPathFromLink(verificationLinkFor($user));

    $this->getJson(str_replace('/'.sha1($user->email), '/'.sha1('otro@example.com'), $path))->assertForbidden();
    $this->getJson($path.'x')->assertForbidden();

    $this->travel(2)->hours();
    $this->getJson($path)->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('does not reveal which user ids exist when the hash does not match', function () {
    // Firma válida (generada para un usuario real) pero con el id de otro.
    $real = User::factory()->unverified()->create();
    parse_str((string) parse_url(verificationLinkFor($real), PHP_URL_QUERY), $q);

    $this->getJson("/api/email/verify/999999/{$q['hash']}?expires={$q['expires']}&signature={$q['signature']}")
        ->assertForbidden();
});

it('sends the confirmation email on registration only when verification is required', function () {
    Notification::fake();

    $this->postJson('/api/register', ['name' => 'Odei', 'email' => 'a@example.com', 'password' => 'abcdefgh', 'password_confirmation' => 'abcdefgh'])
        ->assertCreated();
    Notification::assertNothingSent();

    config(['auth.require_email_verification' => true]);
    $this->postJson('/api/register', ['name' => 'Odei', 'email' => 'b@example.com', 'password' => 'abcdefgh', 'password_confirmation' => 'abcdefgh'])
        ->assertCreated();
    Notification::assertSentTo(User::where('email', 'b@example.com')->first(), VerifyEmailNotification::class);
});

it('does not break the registration when the confirmation email cannot be sent', function () {
    config(['auth.require_email_verification' => true]);
    // Simula el fallo del remitente de pruebas de Resend con un mailer que lanza.
    config(['mail.default' => 'failing']);
    config(['mail.mailers.failing' => ['transport' => 'resend']]);
    config(['services.resend.key' => null]);
    Log::spy();

    $this->postJson('/api/register', ['name' => 'Odei', 'email' => 'c@example.com', 'password' => 'abcdefgh', 'password_confirmation' => 'abcdefgh'])
        ->assertCreated();

    expect(User::where('email', 'c@example.com')->exists())->toBeTrue();
    // El envío falló de verdad (y quedó anotado), no es un test vacío.
    Log::shouldHaveReceived('warning')->withArgs(fn ($message) => str_contains($message, 'No se pudo enviar'))->once();
});

it('leaves the baby data open to an unverified user while verification is not required', function () {
    $user = User::factory()->unverified()->create();
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson('/api/babies')->assertOk();
});

it('blocks the baby data for an unverified user when verification is required, but not the profile', function () {
    config(['auth.require_email_verification' => true]);
    $user = User::factory()->unverified()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson('/api/babies')->assertForbidden()->assertJsonPath('code', 'email_unverified');
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson("/api/babies/{$baby->id}/bootstrap")->assertForbidden();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/user')->assertOk()->assertJsonPath('email_verification_required', true);
});

it('lets a verified user through when verification is required', function () {
    config(['auth.require_email_verification' => true]);
    $user = User::factory()->create();

    $this->withToken($user->createToken('t')->plainTextToken)->getJson('/api/babies')->assertOk();
});

it('resends the confirmation email to the logged-in user, and does nothing if already confirmed', function () {
    Notification::fake();
    $unverified = User::factory()->unverified()->create();

    $this->withToken($unverified->createToken('t')->plainTextToken)
        ->postJson('/api/email/verification-notification')->assertOk();
    Notification::assertSentTo($unverified, VerifyEmailNotification::class);

    Notification::fake();
    $this->app['auth']->forgetGuards();
    $verified = User::factory()->create();
    $this->withToken($verified->createToken('t')->plainTextToken)
        ->postJson('/api/email/verification-notification')->assertOk();
    Notification::assertNothingSent();
});

it('marks the accounts that already exist as verified in the data migration', function () {
    $old = User::factory()->unverified()->create();

    (include database_path('migrations/2026_10_13_120000_mark_existing_users_as_verified.php'))->up();

    expect($old->fresh()->hasVerifiedEmail())->toBeTrue();
});
