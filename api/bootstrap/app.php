<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // This app is API-only - routes/web.php has no named "login" route
        // to send anyone to. Laravel's own default unauthenticated-request
        // handling only renders JSON when the request already carries
        // Accept: application/json; otherwise it falls back to
        // redirect()->guest($exception->redirectTo() ?? route('login')),
        // which throws RouteNotFoundException here and surfaces as a
        // confusing 500 instead of a clean 401 (found directly: a plain
        // curl request with no Accept header hit this). Every route this
        // app serves is JSON, so render this one exception type as JSON
        // unconditionally rather than relying on the Accept header. Needs
        // AppServiceProvider's own Authenticate::redirectUsing(fn () => null)
        // alongside this - without it, the same route('login') call happens
        // even earlier, inside the auth middleware itself while building
        // the exception, before this override ever gets a chance to run.
        $exceptions->render(function (AuthenticationException $e) {
            return response()->json(['message' => $e->getMessage()], 401);
        });
    })->create();
