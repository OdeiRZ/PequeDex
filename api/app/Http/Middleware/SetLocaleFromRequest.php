<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Los mensajes del API (validación, errores) salen en el idioma de la app que
 * llama: el frontend manda su idioma en `Accept-Language`. Antes todo salía
 * en español aunque la app estuviera en inglés. Solo se aceptan los idiomas
 * que tiene la app; con cualquier otro valor, o sin cabecera, se queda el
 * idioma por defecto (`APP_LOCALE`).
 */
class SetLocaleFromRequest
{
    /** @var list<string> */
    public const SUPPORTED = ['es', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $preferred = $request->getPreferredLanguage(self::SUPPORTED);

        if ($request->headers->has('Accept-Language') && $preferred !== null) {
            app()->setLocale($preferred);
        }

        return $next($request);
    }
}
