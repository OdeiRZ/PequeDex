<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class DeleteAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La contraseña actual como confirmación: borrar la cuenta no se puede
     * deshacer, y un token robado o un móvil prestado no deberían bastar.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'current_password:sanctum'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'current_password.required' => 'Escribe tu contraseña para confirmar.',
            'current_password.current_password' => 'La contraseña no es correcta.',
        ];
    }
}
