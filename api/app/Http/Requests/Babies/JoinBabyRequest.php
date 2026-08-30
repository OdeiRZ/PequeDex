<?php

namespace App\Http\Requests\Babies;

use Illuminate\Foundation\Http\FormRequest;

class JoinBabyRequest extends FormRequest
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
            'invite_code' => ['required', 'string', 'exists:babies,invite_code'],
        ];
    }
}
