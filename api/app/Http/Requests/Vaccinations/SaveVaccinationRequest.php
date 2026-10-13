<?php

namespace App\Http\Requests\Vaccinations;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Crear (vacuna añadida a mano) y editar (marcar como puesta, cambiar la
 * fecha prevista, una nota con el lote...) comparten reglas.
 */
class SaveVaccinationRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
            'given_at' => ['nullable', 'date', 'before_or_equal:tomorrow', ...$this->notBeforeBirthRule()],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...$this->dateFieldMessages('given_at', 'la fecha en que se puso'),
            'name.required' => __('Indica el nombre de la vacuna.'),
        ];
    }
}
