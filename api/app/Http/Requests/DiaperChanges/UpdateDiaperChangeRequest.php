<?php

namespace App\Http\Requests\DiaperChanges;

use App\Enums\DiaperType;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDiaperChangeRequest extends FormRequest
{
    use AuthorizesBabyAccess;
    use ValidatesNotBeforeBirth;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'changed_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'type' => ['required', Rule::enum(DiaperType::class)],
            'notes' => ['nullable', 'string'],
        ];
    }
}
