<?php

use App\Models\Milestone;
use Illuminate\Support\Facades\Storage;

/** Una foto "de móvil" grande y poco comprimible, como un JPEG de verdad. */
function bigJpeg(int $width = 3200, int $height = 2400): string
{
    $image = imagecreatetruecolor($width, $height);
    for ($x = 0; $x < $width; $x += 3) {
        imageline($image, $x, 0, $x, $height, imagecolorallocate($image, $x % 256, ($x * 5) % 256, ($x * 11) % 256));
    }
    ob_start();
    imagejpeg($image, null, 95);

    return (string) ob_get_clean();
}

beforeEach(function () {
    Storage::fake('public');
});

it('only reports what it would save without --apply, and touches nothing', function () {
    $jpeg = bigJpeg();
    Storage::disk('public')->put('milestones/1/vieja.jpg', $jpeg);
    $milestone = Milestone::factory()->create(['photo_path' => 'milestones/1/vieja.jpg']);

    $this->artisan('milestones:shrink-photos')
        ->expectsOutputToContain('Simulación')
        ->expectsOutputToContain('se reducirían')
        ->assertSuccessful();

    expect($milestone->fresh()->photo_path)->toBe('milestones/1/vieja.jpg');
    Storage::disk('public')->assertExists('milestones/1/vieja.jpg');
    expect(Storage::disk('public')->get('milestones/1/vieja.jpg'))->toBe($jpeg);
});

it('replaces an old big photo with a shrunken WebP and deletes the original with --apply', function () {
    $jpeg = bigJpeg();
    Storage::disk('public')->put('milestones/1/vieja.jpg', $jpeg);
    $milestone = Milestone::factory()->create(['photo_path' => 'milestones/1/vieja.jpg']);

    $this->artisan('milestones:shrink-photos --apply')->assertSuccessful();

    $newPath = $milestone->fresh()->photo_path;
    expect($newPath)->not->toBe('milestones/1/vieja.jpg')->and($newPath)->toEndWith('.webp');
    Storage::disk('public')->assertMissing('milestones/1/vieja.jpg');
    Storage::disk('public')->assertExists($newPath);

    $stored = Storage::disk('public')->get($newPath);
    $size = getimagesizefromstring($stored);
    expect([$size[0], $size[1]])->toBe([1600, 1200])
        ->and(strlen($stored))->toBeLessThan(strlen($jpeg) / 2);
});

it('leaves alone a photo that is already a small WebP, and a missing file', function () {
    $image = imagecreatetruecolor(400, 300);
    ob_start();
    imagewebp($image, null, 80);
    $webp = (string) ob_get_clean();
    Storage::disk('public')->put('milestones/1/ya.webp', $webp);
    $small = Milestone::factory()->create(['photo_path' => 'milestones/1/ya.webp']);
    $missing = Milestone::factory()->create(['photo_path' => 'milestones/1/no-existe.jpg']);
    $without = Milestone::factory()->create(['photo_path' => null]);

    $this->artisan('milestones:shrink-photos --apply')
        ->expectsOutputToContain('no existe en el disco')
        ->assertSuccessful();

    expect($small->fresh()->photo_path)->toBe('milestones/1/ya.webp')
        ->and($missing->fresh()->photo_path)->toBe('milestones/1/no-existe.jpg')
        ->and($without->fresh()->photo_path)->toBeNull();
    Storage::disk('public')->assertExists('milestones/1/ya.webp');
});

it('keeps the original when the photo cannot be decoded', function () {
    Storage::disk('public')->put('milestones/1/rota.jpg', 'esto no es una imagen');
    $milestone = Milestone::factory()->create(['photo_path' => 'milestones/1/rota.jpg']);

    $this->artisan('milestones:shrink-photos --apply')->assertSuccessful();

    expect($milestone->fresh()->photo_path)->toBe('milestones/1/rota.jpg');
    Storage::disk('public')->assertExists('milestones/1/rota.jpg');
});
