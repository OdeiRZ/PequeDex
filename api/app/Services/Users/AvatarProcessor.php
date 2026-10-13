<?php

namespace App\Services\Users;

use GdImage;
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
    // 128px is plenty for the largest place the avatar is shown (a few
    // dozen CSS pixels, even on a 3x screen) and keeps the data: URI at a
    // few KB. It used to be 320px PNG (~80 KB), and since the avatar
    // travels in the user JSON (and in every milestone "liked by"), that
    // weight was paid on every request that serialized a user.
    private const MAX_DIMENSION = 128;

    private const WEBP_QUALITY = 80;

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
     * on display, not here) and re-encodes as WebP, which keeps
     * transparency. Returns the result as a data: URI, ready to drop
     * straight into an <img src> or store in user_avatars.data.
     */
    public function process(UploadedFile $file): string
    {
        $dimensions = getimagesize($file->getRealPath());

        if ($dimensions === false) {
            throw new RuntimeException(__('No se ha podido leer la imagen.'));
        }

        return $this->shrink($file->get(), $dimensions[0], $dimensions[1]);
    }

    /**
     * Same shrink for an avatar already stored as a data: URI (the old
     * 320px PNGs, when they were moved to their own table). Null if it
     * can't be read - the caller keeps the original in that case.
     */
    public function shrinkDataUri(string $dataUri): ?string
    {
        if (! preg_match('#^data:image/[a-z+]+;base64,(.+)$#s', $dataUri, $match)) {
            return null;
        }

        $binary = base64_decode($match[1], true);
        // El @ es deliberado: con datos que no son una imagen, PHP avisa
        // además de devolver false, y aquí "no se pudo leer" es un caso normal.
        $dimensions = $binary === false ? false : @getimagesizefromstring($binary);

        if ($dimensions === false) {
            return null;
        }

        try {
            return $this->shrink($binary, $dimensions[0], $dimensions[1]);
        } catch (RuntimeException) {
            return null;
        }
    }

    private function shrink(string $binary, int $sourceWidth, int $sourceHeight): string
    {
        if ($sourceWidth > self::MAX_SOURCE_DIMENSION || $sourceHeight > self::MAX_SOURCE_DIMENSION) {
            throw new RuntimeException(__('La imagen es demasiado grande.'));
        }

        $source = imagecreatefromstring($binary);

        if ($source === false) {
            throw new RuntimeException(__('No se ha podido leer la imagen.'));
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

        $webp = $this->encodeWebp($target);

        imagedestroy($source);
        imagedestroy($target);

        return 'data:image/webp;base64,'.base64_encode($webp);
    }

    private function encodeWebp(GdImage $image): string
    {
        ob_start();
        imagewebp($image, null, self::WEBP_QUALITY);

        return (string) ob_get_clean();
    }
}
