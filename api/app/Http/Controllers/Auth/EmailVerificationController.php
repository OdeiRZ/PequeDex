<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class EmailVerificationController extends Controller
{
    /**
     * Confirma el email. Sin autenticación a propósito: el enlace se abre
     * desde el correo, quizá en otro dispositivo donde no hay sesión; lo que
     * lo protege es la firma (middleware `signed:relative`) y el hash del
     * email. La SPA reenvía a esta ruta los parámetros del enlace.
     */
    public function verify(string $id, string $hash): JsonResponse
    {
        $user = User::find($id);

        // Misma respuesta para "no existe" y "hash incorrecto": no revela qué ids existen.
        if ($user === null || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return response()->json(['message' => __('El enlace de confirmación no es válido.')], 422);
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return response()->json(['message' => __('Tu email está confirmado.')]);
    }

    /** Reenvía el correo de confirmación al usuario autenticado. */
    public function resend(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => __('Tu email ya estaba confirmado.')]);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (Throwable $e) {
            // Con el remitente de pruebas de Resend (sin dominio propio) el envío a
            // cualquiera que no sea el dueño de la cuenta falla; no se esconde.
            Log::warning('No se pudo enviar el correo de confirmación: '.$e->getMessage());

            return response()->json(['message' => __('No se ha podido enviar el correo. Inténtalo más tarde.')], 503);
        }

        return response()->json(['message' => __('Te hemos enviado un correo de confirmación.')]);
    }
}
