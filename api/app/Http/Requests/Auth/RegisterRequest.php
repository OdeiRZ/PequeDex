<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            // Opcional: quien llega desde "Tengo una invitación" en la
            // pantalla de bienvenida crea su cuenta y se une al bebé en el
            // mismo paso (ver AuthController::register()) - un registro
            // normal, sin invitación, no manda este campo. Misma regla
            // exists:babies,invite_code que ya usa JoinBabyRequest, para
            // que un código erróneo falle aquí igual que fallaría allí.
            'invite_code' => ['nullable', 'string', 'exists:babies,invite_code'],
        ];
    }
}
