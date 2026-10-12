<?php

namespace App\Console\Commands;

use App\Models\Milestone;
use App\Services\Milestones\PhotoProcessor;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Reduce las fotos de hitos subidas antes de que existiera PhotoProcessor
 * (se guardaban tal cual, hasta 8 MB). Sin --apply solo cuenta lo que
 * ahorraría y no toca nada. Con --apply guarda la versión reducida, apunta
 * el hito a ella y borra la original, y solo después de comprobar que la
 * nueva existe. La original no se puede recuperar: es el precio de ahorrar.
 */
class ShrinkMilestonePhotos extends Command
{
    protected $signature = 'milestones:shrink-photos {--apply : Guardar los cambios (sin esto, solo se muestra lo que se ahorraría)}';

    protected $description = 'Reduce las fotos de hitos antiguas a WebP de 1600 px como máximo';

    /** Una foto ya reducida (WebP) de este tamaño o menos no se toca. */
    private const ALREADY_SMALL_BYTES = 600_000;

    public function handle(PhotoProcessor $processor): int
    {
        $apply = (bool) $this->option('apply');
        $disk = Storage::disk(config('filesystems.milestones_disk'));
        $before = 0;
        $after = 0;
        $changed = 0;

        $this->info($apply ? 'Reduciendo las fotos (se guardan los cambios).' : 'Simulación: no se cambia nada (usa --apply para guardar).');

        Milestone::query()->whereNotNull('photo_path')->orderBy('id')->each(function (Milestone $milestone) use ($processor, $disk, $apply, &$before, &$after, &$changed) {
            $path = $milestone->photo_path;

            if (! $disk->exists($path)) {
                $this->warn("Hito {$milestone->id}: la foto {$path} no existe en el disco, se omite.");

                return;
            }

            $original = $disk->get($path);
            $size = strlen($original);

            if (str_ends_with($path, '.webp') && $size <= self::ALREADY_SMALL_BYTES) {
                return;
            }

            $webp = $this->shrink($processor, $original);

            if ($webp === null || strlen($webp) >= $size) {
                $this->line("Hito {$milestone->id}: sin cambios (no se puede reducir o no ahorraría).");

                return;
            }

            $before += $size;
            $after += strlen($webp);
            $changed++;
            $this->line(sprintf('Hito %d: %s -> %s', $milestone->id, $this->kb($size), $this->kb(strlen($webp))));

            if (! $apply) {
                return;
            }

            $newPath = "milestones/{$milestone->baby_id}/".Str::uuid().'.webp';
            $disk->put($newPath, $webp);

            if (! $disk->exists($newPath)) {
                $this->error("Hito {$milestone->id}: no se pudo guardar la versión reducida, se deja la original.");

                return;
            }

            $milestone->updateQuietly(['photo_path' => $newPath]);
            $disk->delete($path);
        });

        $this->newLine();
        $this->info(sprintf(
            '%d foto(s) %s: %s -> %s (ahorro %s).',
            $changed,
            $apply ? 'reducida(s)' : 'se reducirían',
            $this->kb($before),
            $this->kb($after),
            $this->kb($before - $after),
        ));

        return self::SUCCESS;
    }

    private function shrink(PhotoProcessor $processor, string $binary): ?string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'foto');
        file_put_contents($tmp, $binary);

        try {
            $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);

            return $processor->process(new UploadedFile($tmp, 'foto', $mime, null, true));
        } finally {
            @unlink($tmp);
        }
    }

    private function kb(int $bytes): string
    {
        return number_format($bytes / 1024, 0, ',', '.').' KB';
    }
}
