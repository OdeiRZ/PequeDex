<?php

namespace App\Http\Requests\Babies;

use App\Enums\BabySex;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBabyRequest extends FormRequest
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
            'name' => ['nullable', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
            'birth_date' => ['nullable', 'date'],
            // Optional even at creation time - not every family knows or
            // wants to say it yet. Growth percentiles just aren't shown
            // until it's set (see WhoGrowthStandards).
            'sex' => ['nullable', Rule::enum(BabySex::class)],
        ];
    }
}
