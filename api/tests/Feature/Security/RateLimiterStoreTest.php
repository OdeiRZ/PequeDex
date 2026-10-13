<?php

use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Cache\RateLimiter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter as RateLimiterFacade;

// Los contadores de los límites se tocan en cada petición: no deben ir a la base
// de datos (con la caché `database` eran 6 consultas extra por petición).
it('keeps the rate limiter counters out of the database', function () {
    $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pequedex-limiter-'.uniqid();
    config([
        'cache.default' => 'database',
        'cache.stores.file.path' => $dir,
        'cache.stores.file.lock_path' => $dir,
        'cache.limiter' => 'file',
    ]);
    // El RateLimiter ya estaba construido con el almacén de pruebas: rehacerlo.
    $this->app->forgetInstance(RateLimiter::class);
    $this->app->forgetInstance('cache');
    RateLimiterFacade::clearResolvedInstance(RateLimiter::class);
    // Los limitadores con nombre ('api', 'exports') se registran al arrancar
    // la app sobre el RateLimiter anterior: volver a registrarlos.
    $this->app->getProvider(AppServiceProvider::class)->boot();

    $token = User::factory()->create()->createToken('t')->plainTextToken;

    DB::enableQueryLog();
    $this->withToken($token)->getJson('/api/user')->assertOk();
    $tables = collect(DB::getQueryLog())->pluck('query')->implode(' ');

    expect($tables)->not->toContain('"cache"');
    // El contador sí se guardó, en un fichero.
    expect(glob($dir.'/*/*/*') ?: glob($dir.'/*'))->not->toBeEmpty();

    app('files')->deleteDirectory($dir);
});

it('defaults the limiter store to a file, not to the database', function () {
    // En pruebas se fija `array` por variable de entorno (phpunit.xml); lo que
    // cuenta es el valor por defecto cuando la variable no existe.
    expect(file_get_contents(config_path('cache.php')))->toContain("env('CACHE_LIMITER_STORE', 'file')");
});
