<?php

namespace App\Providers;

use Illuminate\Auth\Middleware\Authenticate;
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

        // Pairs with bootstrap/app.php's own AuthenticationException render()
        // override - see that comment for why an API-only app (no named
        // "login" route) needs both. Without this, route('login') is called
        // here first, before the exception render() override ever runs.
        Authenticate::redirectUsing(fn () => null);
    }
}
