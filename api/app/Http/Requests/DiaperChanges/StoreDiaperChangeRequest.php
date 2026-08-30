<?php

namespace App\Http\Requests\DiaperChanges;

use App\Enums\DiaperType;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDiaperChangeRequest extends FormRequest
{
    use ValidatesNotBeforeBirth;

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
            'changed_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            'type' => ['required', Rule::enum(DiaperType::class)],
            'notes' => ['nullable', 'string'],
        ];
    }
}
