<?php

namespace App\Http\Requests\Auth;

use App\Enums\TemperatureMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDefaultTemperatureMethodRequest extends FormRequest
{
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
            'default_temperature_method' => ['nullable', Rule::enum(TemperatureMethod::class)],
        ];
    }
}
