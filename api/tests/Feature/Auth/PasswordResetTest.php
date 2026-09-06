<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Notification;

// PequeDex has no Accept-Language-driven locale switching on the backend
// (unlike LudoDex/MIRA_MarketLens) - every request runs in APP_LOCALE (es),
// same as the rest of the app's validation/auth responses. The notification
// itself is still built translatable (lang/{es,en}/mail.php) so it's ready
// if that middleware is ever added, but these tests exercise the locale
// PequeDex actually runs today; the English-branding test below switches
// locale directly rather than pretending a header controls it.

it('sends a reset link notification for an existing email', function () {
    Notification::fake();

    $user = User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com'])
        ->assertOk()
        ->assertJsonPath('message', 'Te hemos enviado por email el enlace para restablecer la contraseña.');

    Notification::assertSentTo($user, ResetPasswordNotification::class);
});

it('points the reset link at the frontend, not a server-rendered route', function () {
    Notification::fake();

    $user = User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com']);

    Notification::assertSentTo(
        $user,
        ResetPasswordNotification::class,
        function (ResetPasswordNotification $notification) use ($user) {
            $mail = $notification->toMail($user);
            $url = $mail->actionUrl;

            expect($url)->toStartWith('http://localhost:5173/reset-password?token=')
                ->and($url)->toContain('email=odei%40example.com');

            return true;
        }
    );
});

it('responds the same way for an email that does not exist, to avoid leaking which emails are registered', function () {
    Notification::fake();

    $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])
        ->assertOk()
        ->assertJsonPath('message', 'Te hemos enviado por email el enlace para restablecer la contraseña.');

    // La respuesta es idéntica a la de un email real, pero por debajo
    // Password::sendResetLink() no envía nada - nadie recibe un email para
    // una cuenta que no existe, solo cambia lo que ve quien hace la petición.
    Notification::assertNothingSent();
});

it('responds the same way when a reset was already requested moments ago, not a distinct throttled message', function () {
    Notification::fake();

    User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com'])->assertOk();

    // Pedirlo de nuevo enseguida entra en el throttle interno de Laravel
    // (Password::RESET_THROTTLED) - antes de esta corrección, ese estado
    // también generaba un mensaje propio, otra forma sutil de distinguir
    // un email registrado de uno que no lo está.
    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com'])
        ->assertOk()
        ->assertJsonPath('message', 'Te hemos enviado por email el enlace para restablecer la contraseña.');
});

it('resets the password with a valid token and lets the user log in with it', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'odei@example.com',
        'password' => bcrypt('old-password'),
    ]);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com']);

    $token = null;
    Notification::assertSentTo(
        $user,
        ResetPasswordNotification::class,
        function (ResetPasswordNotification $notification) use (&$token) {
            $token = $notification->token;

            return true;
        }
    );

    $this->postJson('/api/reset-password', [
        'token' => $token,
        'email' => 'odei@example.com',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertOk()->assertJsonPath('message', 'Tu contraseña se ha restablecido.');

    $this->postJson('/api/login', [
        'email' => 'odei@example.com',
        'password' => 'new-password',
    ])->assertOk();
});

it('rejects an invalid reset token', function () {
    User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/reset-password', [
        'token' => 'not-a-real-token',
        'email' => 'odei@example.com',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'Ese enlace para restablecer la contraseña no es válido.');
});

it('rejects a password reset with a mismatched password confirmation', function () {
    User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/reset-password', [
        'token' => 'not-a-real-token',
        'email' => 'odei@example.com',
        'password' => 'new-password',
        'password_confirmation' => 'a-different-password',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');
});

it('sends the reset email branded as PequeDex, in Spanish', function () {
    Notification::fake();

    $user = User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com']);

    Notification::assertSentTo(
        $user,
        ResetPasswordNotification::class,
        function (ResetPasswordNotification $notification) use ($user) {
            $mail = $notification->toMail($user);

            expect($mail->subject)->toBe('Restablece tu contraseña de PequeDex')
                ->and($mail->greeting)->toBe('¡Hola!')
                ->and($mail->introLines)->toContain('Recibes este email porque hemos recibido una solicitud para restablecer la contraseña de tu cuenta de PequeDex.')
                ->and($mail->actionText)->toBe('Restablecer contraseña')
                ->and($mail->salutation)->toBe("Un saludo,\nEl equipo de PequeDex");

            return true;
        }
    );
});

it('builds the reset email branded as PequeDex, in English, when the app locale is English', function () {
    Notification::fake();

    app()->setLocale('en');

    $user = User::factory()->create(['email' => 'odei@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'odei@example.com']);

    Notification::assertSentTo(
        $user,
        ResetPasswordNotification::class,
        function (ResetPasswordNotification $notification) use ($user) {
            $mail = $notification->toMail($user);

            expect($mail->subject)->toBe('Reset your PequeDex password')
                ->and($mail->greeting)->toBe('Hello!')
                ->and($mail->actionText)->toBe('Reset password')
                ->and($mail->salutation)->toBe("Best,\nThe PequeDex team");

            return true;
        }
    );
});
