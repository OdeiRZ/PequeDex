<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    /**
     * Misma respuesta exista o no ese email (Password::INVALID_USER) o
     * aunque se haya pedido hace muy poco (Password::RESET_THROTTLED) -
     * mismo criterio ya aplicado en MIRA_MarketLens tras una auditoría de
     * seguridad: devolver un mensaje distinto según el estado permitía
     * enumerar qué emails están registrados probando este endpoint
     * repetidamente. Password::sendResetLink() ya se encarga por su cuenta
     * de no enviar nada cuando el usuario no existe, así que ignorar aquí
     * su estado no cambia el comportamiento real, solo lo que ve quien hace
     * la petición.
     */
    public function sendResetLink(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->only('email'));

        return response()->json(['message' => __(Password::RESET_LINK_SENT)]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }

        return response()->json(['message' => __($status)]);
    }
}
