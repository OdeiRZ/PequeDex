<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Baby;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Envuelto en transacción (mismo motivo que BabyController::store()):
     * sin ella, un fallo entre crear el usuario y unirlo al bebé dejaría
     * una cuenta ya creada pero sin el bebé de la invitación - un login
     * manual después, ya sin código a mano, no tiene forma de recuperar
     * esa unión.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        [$user, $token] = DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->validated('name'),
                'email' => $request->validated('email'),
                'password' => Hash::make($request->validated('password')),
            ]);

            // invite_code ya validado contra babies.invite_code
            // (RegisterRequest, exists:babies,invite_code) - si llega
            // aquí, el bebé existe de verdad.
            $inviteCode = $request->validated('invite_code');
            if ($inviteCode !== null) {
                Baby::where('invite_code', $inviteCode)->firstOrFail()->users()->attach($user);
            }

            return [$user, $user->createToken('PequeDex')->plainTextToken];
        });

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->validated('email'))->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        $token = $user->createToken('PequeDex')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(status: 204);
    }
}
