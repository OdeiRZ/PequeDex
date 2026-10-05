<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDefaultFeedDurationRequest extends FormRequest
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
            // Mismas opciones que feedDurationOptions en DashboardView.vue.
            'default_feed_duration_minutes' => ['nullable', Rule::in([10, 15, 20, 30, 45])],
        ];
    }
}
