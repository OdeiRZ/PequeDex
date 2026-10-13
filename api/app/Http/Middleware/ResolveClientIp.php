<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Detrás de Render el servidor solo ve la IP de su proxy, así que
 * `$request->ip()` era la misma para todos los clientes: el límite de
 * intentos de login (`throttle:6,1`, por IP) funcionaba como UN solo cubo
 * compartido, y cualquiera podía bloquear el acceso de los demás.
 *
 * Cloudflare (que va delante de Render) pone la IP real en
 * `CF-Connecting-IP` y pisa cualquier valor que mande el cliente, así que
 * esa cabecera sí es fiable en producción. Se copia a REMOTE_ADDR antes de
 * que nada (límites, logs, Sentry) pregunte la IP.
 *
 * No se confía en `X-Forwarded-For`: el primer valor lo escribe el propio
 * cliente y cualquiera podría saltarse el límite cambiándolo.
 *
 * Solo se aplica en producción: en local y en tests la cabecera podría
 * mandarla cualquiera y no hay Cloudflare que la sobrescriba.
 */
class ResolveClientIp
{
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->headers->get('CF-Connecting-IP');

        if (app()->isProduction() && is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) !== false) {
            $request->server->set('REMOTE_ADDR', $ip);
        }

        return $next($request);
    }
}
