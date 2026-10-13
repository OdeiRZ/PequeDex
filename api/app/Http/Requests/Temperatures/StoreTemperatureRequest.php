<?php

namespace App\Http\Requests\Temperatures;

use App\Enums\TemperatureMethod;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTemperatureRequest extends FormRequest
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
            ...self::temperatureRules($this->notBeforeBirthRule()),
            // Identificador generado en el móvil para el registro sin
            // conexión (ver App\Http\Controllers\Concerns\CreatesIdempotently).
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }

    /**
     * Compartidas con UpdateTemperatureRequest. 34-43 °C: fuera de ese
     * rango es casi seguro un error al teclear (3.7 en vez de 37), no una
     * medición real.
     *
     * @param  array<int, mixed>  $notBeforeBirth
     * @return array<string, mixed>
     */
    public static function temperatureRules(array $notBeforeBirth): array
    {
        return [
            'measured_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$notBeforeBirth],
            'celsius' => ['required', 'numeric', 'between:34,43'],
            'method' => ['nullable', Rule::enum(TemperatureMethod::class)],
            'notes' => ['nullable', 'string'],
        ];
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
