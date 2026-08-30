<?php

namespace App\Http\Requests\Sleeps;

use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSleepRequest extends FormRequest
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
            'started_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            'ended_at' => ['nullable', 'date', 'after:started_at'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
