<?php

namespace App\Http\Requests\VitaminD;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpsertVitaminDDoseRequest extends FormRequest
{
    use AuthorizesBabyAccess;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date', 'before_or_equal:today'],
            'given' => ['required', 'boolean'],
        ];
    }

    /**
     * A dose only makes sense once a pauta exists for this baby, and
     * only on or after the day it started - checked here (not as a
     * simple rule string) because both depend on the baby's own
     * schedule, not on another request field.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $schedule = $this->route('baby')->vitaminDSchedule;

            if ($schedule === null) {
                $validator->errors()->add('date', 'Todavía no hay una pauta de vitamina D activada para este bebé.');

                return;
            }

            $date = $this->input('date');

            if (is_string($date) && $date < $schedule->start_date->toDateString()) {
                $validator->errors()->add('date', 'No puedes marcar un día anterior al inicio de la pauta.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.required' => 'Indica la fecha.',
            'date.date' => 'La fecha no es válida.',
            'date.before_or_equal' => 'No puedes marcar un día futuro.',
            'given.required' => 'Indica si se le dio la dosis.',
        ];
    }
}
