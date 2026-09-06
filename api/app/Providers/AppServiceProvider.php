<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Auth\Notifications\ResetPassword;
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
    }
}
