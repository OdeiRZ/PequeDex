<?php

namespace App\Http\Requests\GrowthMeasurements;

use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

class StoreGrowthMeasurementRequest extends FormRequest
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
            'measured_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            // At least one of the three - a measurement recording nothing
            // isn't worth a row.
            'weight_grams' => ['required_without_all:height_cm,head_circumference_cm', 'nullable', 'integer', 'min:1'],
            'height_cm' => ['required_without_all:weight_grams,head_circumference_cm', 'nullable', 'numeric', 'min:1'],
            'head_circumference_cm' => ['required_without_all:weight_grams,height_cm', 'nullable', 'numeric', 'min:1'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
