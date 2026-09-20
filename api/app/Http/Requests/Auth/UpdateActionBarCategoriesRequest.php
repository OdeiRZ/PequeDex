<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateActionBarCategoriesRequest extends FormRequest
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
            // min:3 impone el minimo de accesos visibles que pidio el
            // usuario, no solo una preferencia de UI - sin esto un cliente
            // (o un bug del frontend) podria dejar la barra con 0-2
            // elementos.
            'action_bar_categories' => ['required', 'array', 'min:3'],
            'action_bar_categories.*' => [
                'string',
                Rule::in(['feed', 'sleep', 'diaper', 'growth', 'milestone']),
                'distinct',
            ],
        ];
    }
}
