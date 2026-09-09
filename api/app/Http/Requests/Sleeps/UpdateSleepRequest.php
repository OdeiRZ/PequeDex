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
            'started_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'ended_at' => ['nullable', 'date', 'after:started_at', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
            'notes' => ['nullable', 'string'],
        ];
    }
}
