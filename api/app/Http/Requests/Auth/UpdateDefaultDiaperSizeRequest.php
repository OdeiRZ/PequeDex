<?php

namespace App\Http\Requests\Auth;

use App\Enums\DiaperSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDefaultDiaperSizeRequest extends FormRequest
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
            'default_diaper_size' => ['nullable', Rule::enum(DiaperSize::class)],
        ];
    }
}
