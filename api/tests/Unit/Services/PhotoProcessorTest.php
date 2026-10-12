<?php

use App\Services\Milestones\PhotoProcessor;
use Illuminate\Http\UploadedFile;

/** Una foto "de móvil": degradado (no se comprime a nada) del tamaño pedido. */
function phoneJpeg(int $width, int $height, ?int $orientation = null): UploadedFile
{
    $image = imagecreatetruecolor($width, $height);
    for ($x = 0; $x < $width; $x += 3) {
        imageline($image, $x, 0, $x, $height, imagecolorallocate($image, $x % 256, ($x * 5) % 256, ($x * 11) % 256));
    }
    ob_start();
    imagejpeg($image, null, 95);
    $jpeg = (string) ob_get_clean();

    if ($orientation !== null) {
        // APP1 con un EXIF mínimo: una sola etiqueta, Orientation (0x0112).
        $tiff = "II\x2A\x00\x08\x00\x00\x00"        // cabecera little-endian, IFD en el byte 8
            ."\x01\x00"                                 // una entrada
            ."\x12\x01\x03\x00\x01\x00\x00\x00".pack('v', $orientation)."\x00\x00" // tag, SHORT, 1, valor
            ."\x00\x00\x00\x00";                        // sin más IFDs
        $payload = "Exif\x00\x00".$tiff;
        $jpeg = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($payload) + 2).$payload.substr($jpeg, 2);
    }

    $path = tempnam(sys_get_temp_dir(), 'foto');
    file_put_contents($path, $jpeg);

    return new UploadedFile($path, 'foto.jpg', 'image/jpeg', null, true);
}

function dimensionsOf(string $webp): array
{
    $size = getimagesizefromstring($webp);

    return [$size[0], $size[1]];
}

it('shrinks a big phone photo to a much smaller WebP that fits 1600px', function () {
    $photo = phoneJpeg(4000, 3000);

    $webp = (new PhotoProcessor)->process($photo);

    expect($webp)->not->toBeNull()
        ->and(dimensionsOf($webp))->toBe([1600, 1200])
        ->and(strlen($webp))->toBeLessThan($photo->getSize() / 2);
});

it('keeps a small photo at its size', function () {
    $webp = (new PhotoProcessor)->process(phoneJpeg(800, 600));

    expect(dimensionsOf($webp))->toBe([800, 600]);
});

it('applies the EXIF rotation so the photo does not come out sideways', function () {
    // Orientation 6: hay que girarla 90° (una foto "tumbada" de 300x200 se ve de pie, 200x300).
    expect(dimensionsOf((new PhotoProcessor)->process(phoneJpeg(300, 200, 6))))->toBe([200, 300]);
    expect(dimensionsOf((new PhotoProcessor)->process(phoneJpeg(300, 200, 8))))->toBe([200, 300]);
    // Orientation 3 (180°) y 1 (normal) no cambian las proporciones.
    expect(dimensionsOf((new PhotoProcessor)->process(phoneJpeg(300, 200, 3))))->toBe([300, 200]);
    expect(dimensionsOf((new PhotoProcessor)->process(phoneJpeg(300, 200, 1))))->toBe([300, 200]);
});

it('returns null for something it cannot decode, so the original is kept', function () {
    $path = tempnam(sys_get_temp_dir(), 'foto');
    file_put_contents($path, 'esto no es una imagen');
    $file = new UploadedFile($path, 'foto.jpg', 'image/jpeg', null, true);

    expect((new PhotoProcessor)->process($file))->toBeNull();
});
