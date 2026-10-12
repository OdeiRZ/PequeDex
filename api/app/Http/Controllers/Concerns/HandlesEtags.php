<?php

namespace App\Http\Controllers\Concerns;

/**
 * Peticiones condicionales: el cliente envía el ETag que ya tiene
 * (`If-None-Match`) y, si no ha cambiado nada, se le contesta 304 sin cuerpo.
 */
trait HandlesEtags
{
    /**
     * Compara ignorando el prefijo W/ (un proxy puede degradar el ETag a
     * débil al comprimir la respuesta) y admite varios valores.
     */
    private function etagMatches(?string $header, string $etag): bool
    {
        if ($header === null || $header === '') {
            return false;
        }

        $normalize = fn (string $value) => ltrim(trim($value), 'W/');

        return collect(explode(',', $header))
            ->contains(fn (string $candidate) => $normalize($candidate) === $normalize($etag));
    }
}
