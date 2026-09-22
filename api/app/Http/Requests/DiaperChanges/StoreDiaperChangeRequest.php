<?php

namespace App\Http\Requests\DiaperChanges;

use App\Enums\DiaperResidueColor;
use App\Enums\DiaperType;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDiaperChangeRequest extends FormRequest
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
            'changed_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'type' => ['required', Rule::enum(DiaperType::class)],
            // Optional even for a dirty change - not every caregiver
            // wants to note it every time - but meaningless (and
            // prohibited) for a purely wet one.
            'residue_color' => ['nullable', 'prohibited_if:type,'.DiaperType::Mojado->value, Rule::enum(DiaperResidueColor::class)],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...$this->dateFieldMessages('changed_at', 'la hora del cambio'),
            'type.required' => 'Selecciona el tipo de pañal.',
            'residue_color.prohibited_if' => 'El color solo aplica a un pañal sucio.',
        ];
    }
}
