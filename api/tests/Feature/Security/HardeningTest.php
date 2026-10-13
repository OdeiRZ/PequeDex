<?php

use App\Http\Middleware\ResolveClientIp;
use App\Models\Baby;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\PersonalAccessToken;

it('lets the browser cache the CORS preflight', function () {
    $response = $this->call('OPTIONS', '/api/user', [], [], [], [
        'HTTP_ORIGIN' => 'https://odeirz.github.io',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization',
    ]);

    expect($response->headers->get('Access-Control-Max-Age'))->toBe('7200');
});

it('sets basic security headers on every response', function () {
    $response = $this->postJson('/api/login', []);

    expect($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Referrer-Policy'))->toBe('no-referrer')
        ->and($response->headers->get('X-Frame-Options'))->toBe('DENY')
        ->and($response->headers->get('Strict-Transport-Security'))->toContain('max-age=');
});

it('takes the real client IP from CF-Connecting-IP in production only', function () {
    $resolve = function (string $env, ?string $header): string {
        $this->app['env'] = $env;
        $request = Request::create('/api/login', 'POST', server: ['REMOTE_ADDR' => '10.0.0.1']);
        if ($header !== null) {
            $request->headers->set('CF-Connecting-IP', $header);
        }
        (new ResolveClientIp)->handle($request, fn () => response('ok'));

        return (string) $request->ip();
    };

    expect($resolve('production', '203.0.113.9'))->toBe('203.0.113.9')
        ->and($resolve('production', 'not-an-ip'))->toBe('10.0.0.1')
        ->and($resolve('production', null))->toBe('10.0.0.1')
        // Fuera de producción cualquiera podría mandar esa cabecera.
        ->and($resolve('local', '203.0.113.9'))->toBe('10.0.0.1');
});

it('does not trust X-Forwarded-For to identify the client', function () {
    $this->app['env'] = 'production';
    $request = Request::create('/api/login', 'POST', server: ['REMOTE_ADDR' => '10.0.0.1']);
    $request->headers->set('X-Forwarded-For', '198.51.100.77');
    (new ResolveClientIp)->handle($request, fn () => response('ok'));

    expect($request->ip())->toBe('10.0.0.1');
});

it('closes the other sessions when the password is changed, keeping the current one', function () {
    $user = User::factory()->create(['password' => Hash::make('contraseña-vieja')]);
    $current = $user->createToken('actual')->plainTextToken;
    $other = $user->createToken('otro-movil')->plainTextToken;

    $this->withToken($current)->putJson('/api/user/password', [
        'current_password' => 'contraseña-vieja',
        'password' => 'contraseña-nueva',
        'password_confirmation' => 'contraseña-nueva',
    ])->assertNoContent();

    expect($user->tokens()->count())->toBe(1);
    $this->withToken($current)->getJson('/api/user')->assertOk();
    // El otro token ya no existe en la base de datos.
    expect(PersonalAccessToken::findToken($other))->toBeNull();
});

it('closes every session when the password is reset', function () {
    $user = User::factory()->create();
    $user->createToken('movil-perdido');
    $user->createToken('otro');
    $token = Password::createToken($user);

    $this->postJson('/api/reset-password', [
        'email' => $user->email,
        'token' => $token,
        'password' => 'contraseña-nueva',
        'password_confirmation' => 'contraseña-nueva',
    ])->assertOk();

    expect($user->tokens()->count())->toBe(0);
});

it('expires a token after 120 days', function () {
    $user = User::factory()->create();
    $fresh = $user->createToken('reciente')->plainTextToken;
    $old = $user->createToken('antiguo');
    $old->accessToken->forceFill(['created_at' => now()->subDays(121)])->save();

    $this->withToken($fresh)->getJson('/api/user')->assertOk();
    // El guard recuerda al usuario autenticado entre peticiones de un mismo test.
    $this->app['auth']->forgetGuards();
    $this->withToken($old->plainTextToken)->getJson('/api/user')->assertUnauthorized();
});

it('keeps the specific limits whole next to the general one (no double counting)', function () {
    $user = User::factory()->create();
    $token = $user->createToken('t')->plainTextToken;

    // POST /babies permite 10 por minuto; si el límite general compartiera
    // contador, se agotaría a la quinta petición.
    foreach (range(1, 10) as $i) {
        $this->withToken($token)->postJson('/api/babies', ['name' => "Bebé {$i}"])->assertSuccessful();
        $this->app['auth']->forgetGuards();
    }

    $this->withToken($token)->postJson('/api/babies', ['name' => 'Bebé 11'])->assertStatus(429);
});

it('rate-limits the PDF exports', function () {
    $user = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);
    $token = $user->createToken('t')->plainTextToken;

    foreach (range(1, 10) as $i) {
        $this->withToken($token)->postJson("/api/babies/{$baby->id}/stats/export", [])->assertUnprocessable();
    }

    $this->withToken($token)->postJson("/api/babies/{$baby->id}/stats/export", [])->assertStatus(429);
});
