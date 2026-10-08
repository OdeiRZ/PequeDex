<?php

namespace App\Http\Requests\VitaminD;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use Illuminate\Foundation\Http\FormRequest;

class UpsertVitaminDScheduleRequest extends FormRequest
{
    use AuthorizesBabyAccess;

    /**
     * No before_or_equal:today / after_or_equal:today restrictions on
     * either date - the pediatrician's own instruction may already
     * predate the moment the caregiver gets around to turning this on
     * in the app, or may have already ended (editing a finished pauta).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'start_date.required' => 'Indica la fecha de inicio.',
            'start_date.date' => 'La fecha de inicio no es una fecha válida.',
            'end_date.required' => 'Indica la fecha de fin.',
            'end_date.date' => 'La fecha de fin no es una fecha válida.',
            'end_date.after_or_equal' => 'La fecha de fin no puede ser anterior a la de inicio.',
        ];
    }
}
