<?php

namespace App\Services\Users;

use Illuminate\Http\UploadedFile;
use RuntimeException;

/**
 * Plain GD (already bundled with PHP, and already used for the app's own
 * favicon PNG) instead of a new dependency like Intervention Image - the
 * app only ever needs one operation (shrink to fit, re-encode). Same
 * approach as MIRA MarketLens's LogoProcessor.
 */
class AvatarProcessor
{
    private const MAX_DIMENSION = 320;

    // Guards against a decompression bomb - a file that's small in bytes
    // (validated by UpdateAvatarRequest) but claims huge pixel dimensions
    // (a single-color image compresses extremely well) would otherwise be
    // decoded to its full, uncompressed size in memory by
    // imagecreatefromstring() before this class ever gets a chance to
    // shrink it. getimagesize() only reads the file's header, not the
    // pixel data, so it's safe to check before deciding whether to decode
    // at all.
    private const MAX_SOURCE_DIMENSION = 8000;

    /**
     * Resizes to fit within MAX_DIMENSION x MAX_DIMENSION (keeping the
     * original aspect ratio - cropping to a circle/square happens in CSS
     * on display, not here) and re-encodes as PNG, which keeps
     * transparency. Returns the result as a data: URI, ready to drop
     * straight into an <img src> or store in users.avatar.
     */
    public function process(UploadedFile $file): string
    {
        $dimensions = getimagesize($file->getRealPath());

        if ($dimensions === false) {
            throw new RuntimeException('No se ha podido leer la imagen.');
        }

        [$sourceWidth, $sourceHeight] = $dimensions;

        if ($sourceWidth > self::MAX_SOURCE_DIMENSION || $sourceHeight > self::MAX_SOURCE_DIMENSION) {
            throw new RuntimeException('La imagen es demasiado grande.');
        }

        $source = imagecreatefromstring($file->get());

        if ($source === false) {
            throw new RuntimeException('No se ha podido leer la imagen.');
        }

        $scale = min(1, self::MAX_DIMENSION / max($sourceWidth, $sourceHeight));
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));

        $target = imagecreatetruecolor($targetWidth, $targetHeight);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 0, 0, 0, 127));

        imagecopyresampled(
            $target, $source,
            0, 0, 0, 0,
            $targetWidth, $targetHeight, $sourceWidth, $sourceHeight,
        );

        ob_start();
        imagepng($target);
        $png = ob_get_clean();

        imagedestroy($source);
        imagedestroy($target);

        return 'data:image/png;base64,'.base64_encode($png);
    }
}
