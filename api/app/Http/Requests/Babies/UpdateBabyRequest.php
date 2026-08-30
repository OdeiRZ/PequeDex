<?php

namespace App\Http\Requests\Babies;

use App\Enums\BabySex;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBabyRequest extends FormRequest
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
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'birth_date' => ['sometimes', 'nullable', 'date'],
            'sex' => ['sometimes', 'nullable', Rule::enum(BabySex::class)],
        ];
    }
}
