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

    /**
     * Resizes to fit within MAX_DIMENSION x MAX_DIMENSION (keeping the
     * original aspect ratio - cropping to a circle/square happens in CSS
     * on display, not here) and re-encodes as PNG, which keeps
     * transparency. Returns the result as a data: URI, ready to drop
     * straight into an <img src> or store in users.avatar.
     */
    public function process(UploadedFile $file): string
    {
        $source = imagecreatefromstring($file->get());

        if ($source === false) {
            throw new RuntimeException('No se ha podido leer la imagen.');
        }

        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
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
