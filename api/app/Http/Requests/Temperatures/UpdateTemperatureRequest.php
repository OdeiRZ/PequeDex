<?php

namespace App\Http\Requests\Temperatures;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTemperatureRequest extends FormRequest
{
    use AuthorizesBabyAccess;
    use HasDateFieldMessages;
    use ValidatesNotBeforeBirth;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return StoreTemperatureRequest::temperatureRules($this->notBeforeBirthRule());
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...$this->dateFieldMessages('measured_at', 'la hora de la medición'),
            'celsius.required' => __('Indica la temperatura.'),
            'celsius.between' => __('La temperatura debe estar entre 34 y 43 °C.'),
        ];
    }
}
