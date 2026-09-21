<?php

namespace App\Http\Requests\GrowthMeasurements;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

class UpdateGrowthMeasurementRequest extends FormRequest
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
            'measured_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'weight_grams' => ['required_without_all:height_cm,head_circumference_cm', 'nullable', 'integer', 'min:1'],
            'height_cm' => ['required_without_all:weight_grams,head_circumference_cm', 'nullable', 'numeric', 'min:1'],
            'head_circumference_cm' => ['required_without_all:weight_grams,height_cm', 'nullable', 'numeric', 'min:1'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $needOne = 'Introduce al menos el peso, la altura o el perímetro craneal.';

        return [
            ...$this->dateFieldMessages('measured_at', 'la fecha de la medida'),
            'weight_grams.required_without_all' => $needOne,
            'height_cm.required_without_all' => $needOne,
            'head_circumference_cm.required_without_all' => $needOne,
            'weight_grams.min' => 'El peso debe ser mayor que 0.',
            'height_cm.min' => 'La altura debe ser mayor que 0.',
            'head_circumference_cm.min' => 'El perímetro craneal debe ser mayor que 0.',
        ];
    }
}
