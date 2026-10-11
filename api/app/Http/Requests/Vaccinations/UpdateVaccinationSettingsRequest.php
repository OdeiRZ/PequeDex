<?php

namespace App\Http\Requests\Vaccinations;

use App\Enums\Region;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVaccinationSettingsRequest extends FormRequest
{
    use AuthorizesBabyAccess;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'vaccinations_enabled' => ['required', 'boolean'],
            'region' => ['nullable', Rule::enum(Region::class)],
        ];
    }
}
