<?php

namespace App\Services\Milestones;

use GdImage;
use Illuminate\Http\UploadedFile;

/**
 * Reduce la foto de un hito al subirla. Se guardaban tal cual (hasta
 * 8 MB, una foto de móvil sin tocar) y se enseñan en círculos de unas
 * decenas de píxeles y a pantalla completa en el visor: cada apertura de
 * los hitos descargaba megas de más. Aquí queda en WebP de 1600 px como
 * máximo (unos 150-400 KB), que sigue sobrando para una pantalla de móvil.
 *
 * GD puro, como AvatarProcessor. La orientación EXIF se aplica al
 * decodificar: los móviles guardan la foto "tumbada" con una etiqueta de
 * giro, el navegador la respeta al enseñar el original, pero al
 * recodificar la etiqueta se pierde y la foto saldría de lado.
 */
class PhotoProcessor
{
    private const MAX_DIMENSION = 1600;

    private const WEBP_QUALITY = 82;

    /** Por encima de esto no se intenta decodificar (memoria de GD). */
    private const MAX_SOURCE_PIXELS = 50_000_000;

    /**
     * El WebP reducido, o null si la imagen no se puede o no conviene
     * procesar (ilegible, enorme): el llamante guarda entonces el original.
     */
    public function process(UploadedFile $file): ?string
    {
        $dimensions = @getimagesize($file->getRealPath());

        if ($dimensions === false) {
            return null;
        }

        [$width, $height] = $dimensions;

        if ($width * $height > self::MAX_SOURCE_PIXELS || ! $this->fitsInMemory($width, $height)) {
            return null;
        }

        $source = @imagecreatefromstring($file->get());

        if ($source === false) {
            return null;
        }

        $source = $this->applyOrientation($source, $file);
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);

        $scale = min(1, self::MAX_DIMENSION / max($sourceWidth, $sourceHeight));
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));

        $target = imagecreatetruecolor($targetWidth, $targetHeight);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));
        imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);

        ob_start();
        imagewebp($target, null, self::WEBP_QUALITY);
        $webp = (string) ob_get_clean();

        imagedestroy($source);
        imagedestroy($target);

        return $webp === '' ? null : $webp;
    }

    /** GD necesita ~4 bytes por píxel, y a la vez el original y la copia. */
    private function fitsInMemory(int $width, int $height): bool
    {
        $limit = $this->memoryLimitBytes();

        return $limit === null || $width * $height * 6 < $limit * 0.8;
    }

    private function memoryLimitBytes(): ?int
    {
        $raw = trim((string) ini_get('memory_limit'));

        if ($raw === '' || $raw === '-1') {
            return null;
        }

        $number = (int) $raw;

        return match (strtoupper(substr($raw, -1))) {
            'G' => $number * 1024 ** 3,
            'M' => $number * 1024 ** 2,
            'K' => $number * 1024,
            default => $number,
        };
    }

    private function applyOrientation(GdImage $image, UploadedFile $file): GdImage
    {
        if (! function_exists('exif_read_data') || ! in_array($file->getMimeType(), ['image/jpeg', 'image/jpg'], true)) {
            return $image;
        }

        $exif = @exif_read_data($file->getRealPath());
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => null,
        };

        if ($rotated === null || $rotated === false) {
            return $image;
        }

        imagedestroy($image);

        return $rotated;
    }
}
