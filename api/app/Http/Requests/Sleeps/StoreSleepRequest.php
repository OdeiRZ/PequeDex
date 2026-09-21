<?php

namespace App\Http\Requests\Sleeps;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

class StoreSleepRequest extends FormRequest
{
    use AuthorizesBabyAccess;
    use HasDateFieldMessages;
    use ValidatesNotBeforeBirth;

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

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...$this->dateFieldMessages('started_at', 'la hora de inicio'),
            'ended_at.date' => 'La hora de fin no es una fecha válida.',
            'ended_at.after' => 'La hora de fin debe ser posterior a la hora de inicio.',
            'ended_at.before_or_equal' => 'La hora de fin no puede ser posterior al momento actual.',
        ];
    }
}
