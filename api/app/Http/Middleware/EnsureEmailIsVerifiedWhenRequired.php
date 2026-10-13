<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige el email confirmado SOLO si `auth.require_email_verification` está
 * activo (variable `REQUIRE_EMAIL_VERIFICATION`, apagada por defecto).
 *
 * Por qué apagada: el remitente es el sandbox de Resend (`onboarding@resend.dev`,
 * sin dominio verificado), que solo entrega correo al dueño de la cuenta de
 * Resend. Con la verificación obligatoria, nadie más podría confirmar su email
 * ni, por tanto, usar la app. Se enciende cuando haya un dominio verificado.
 *
 * Bloquea solo los datos del bebé (`api/babies...`): el perfil, cerrar sesión,
 * reenviar el correo, descargar los datos y borrar la cuenta siguen disponibles
 * para quien aún no ha confirmado. Responde 403 con `code: email_unverified`,
 * que el frontend reconoce.
 */
class EnsureEmailIsVerifiedWhenRequired
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($request->is('api/babies', 'api/babies/*')
            && config('auth.require_email_verification')
            && $user instanceof MustVerifyEmail
            && ! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => __('Confirma tu email para seguir usando PequeDex.'),
                'code' => 'email_unverified',
            ], 403);
        }

        return $next($request);
    }
}
