<?php

use App\Models\Baby;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

// Todo texto en español que el API envuelve en __() tiene que existir en
// lang/en.json; si no, un usuario con la app en inglés lo vería en español.
it('has an English translation for every Spanish text wrapped in __()', function () {
    $translations = json_decode(file_get_contents(base_path('lang/en.json')), true, flags: JSON_THROW_ON_ERROR);
    $missing = [];

    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path()));
    foreach ($files as $file) {
        if (! $file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }
        preg_match_all("/__\(\s*'((?:[^'\\\\]|\\\\.)*)'/", file_get_contents($file->getPathname()), $matches);
        foreach ($matches[1] as $text) {
            $text = stripslashes($text);
            // Las claves del propio Laravel (auth.failed, passwords.sent...) viven en lang/{es,en}/.
            if (preg_match('/^[a-z_]+\.[a-z_.]+$/', $text) === 1) {
                continue;
            }
            if (! array_key_exists($text, $translations)) {
                $missing[] = $text;
            }
        }
    }

    expect($missing)->toBe([]);
});

it('answers validation errors in the language the app asks for', function () {
    $user = User::factory()->create(['password' => Hash::make('mi-contraseña')]);
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->withHeader('Accept-Language', 'en')
        ->deleteJson('/api/user', [])
        ->assertUnprocessable()
        ->assertJsonPath('errors.current_password.0', 'Enter your password to confirm.');

    $this->app['auth']->forgetGuards();

    $this->withToken($token)->withHeader('Accept-Language', 'es')
        ->deleteJson('/api/user', [])
        ->assertUnprocessable()
        ->assertJsonPath('errors.current_password.0', 'Escribe tu contraseña para confirmar.');
});

it('translates the date messages with their label in English', function () {
    $user = User::factory()->create();
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    $this->actingAs($user, 'sanctum')->withHeader('Accept-Language', 'en')
        ->postJson("/api/babies/{$baby->id}/feeds", ['type' => 'pecho', 'started_at' => 'no-es-una-fecha'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.started_at.0', 'The start time is not a valid date.');
});

it('ignores unsupported languages and keeps the default', function () {
    $user = User::factory()->create();
    $token = $user->createToken('t')->plainTextToken;
    $default = app()->getLocale();

    $this->withToken($token)->withHeader('Accept-Language', 'fr-FR,fr;q=0.9')->getJson('/api/user')->assertOk();

    expect(app()->getLocale())->toBe($default);
});
