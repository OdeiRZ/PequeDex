<?php

use App\Services\Users\AvatarProcessor;

function pngDataUri(int $size): string
{
    $image = imagecreatetruecolor($size, $size);
    // Un degradado: no se comprime a nada, como una foto.
    for ($x = 0; $x < $size; $x += 2) {
        imageline($image, $x, 0, $x, $size, imagecolorallocate($image, $x % 256, ($x * 3) % 256, ($x * 7) % 256));
    }
    ob_start();
    imagepng($image);

    return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
}

it('shrinks an old 320px PNG data URI to a much smaller 128px WebP', function () {
    $old = pngDataUri(320);

    $new = (new AvatarProcessor)->shrinkDataUri($old);

    expect($new)->toStartWith('data:image/webp;base64,')
        ->and(strlen($new))->toBeLessThan(strlen($old) / 2);

    [$width, $height] = getimagesizefromstring(base64_decode(substr($new, strlen('data:image/webp;base64,'))));
    expect([$width, $height])->toBe([128, 128]);
});

it('returns null for something that is not a readable image data URI', function () {
    $processor = new AvatarProcessor;

    expect($processor->shrinkDataUri('no es una imagen'))->toBeNull()
        ->and($processor->shrinkDataUri('data:image/png;base64,@@@'))->toBeNull()
        ->and($processor->shrinkDataUri('data:image/png;base64,'.base64_encode('texto')))->toBeNull();
});
