<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Laravel's own out-of-the-box default is min(8) - every Password::defaults()
        // call across the app (registration, password reset, changing it from the
        // profile page) reads from this one place.
        Password::defaults(fn () => Password::min(6));

        // Laravel's default reset link points at a server-rendered
        // "password.reset" web route, which doesn't exist here - this is an
        // API-only backend with a separate SPA. Point it at the frontend's
        // own reset-password page instead, carrying the token and email as
        // query params the same way that page reads them.
        ResetPassword::createUrlUsing(function (User $user, string $token) {
            $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

            return "{$frontendUrl}/reset-password?token={$token}&email=".urlencode($user->email);
        });

        // Pairs with bootstrap/app.php's own AuthenticationException render()
        // override - see that comment for why an API-only app (no named
        // "login" route) needs both. Without this, route('login') is called
        // here first, before the exception render() override ever runs.
        Authenticate::redirectUsing(fn () => null);

        // Limitadores con nombre y clave propia: los `throttle:N,1` sin nombre
        // comparten contador entre sí (la clave es solo el usuario), así que
        // apilar uno general con otro específico contaría cada petición dos
        // veces en el mismo cubo y recortaría el límite a la mitad.
        //
        // Techo general por usuario, muy por encima del uso normal (sondeo del
        // Dashboard, cola sin conexión al reconectar...): solo frena abusos.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(300)
            ->by('api|'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        // Generar un PDF gasta mucha CPU en una instancia pequeña.
        RateLimiter::for('exports', fn (Request $request) => Limit::perMinute(10)
            ->by('exports|'.($request->user()?->getAuthIdentifier() ?? $request->ip())));
    }
}
