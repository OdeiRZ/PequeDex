<?php

namespace App\Http\Requests\DiaperChanges;

use App\Enums\DiaperType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDiaperChangeRequest extends FormRequest
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
            'changed_at' => ['required', 'date'],
            'type' => ['required', Rule::enum(DiaperType::class)],
            'notes' => ['nullable', 'string'],
        ];
    }
}
