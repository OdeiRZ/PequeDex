<?php

namespace App\Http\Requests\Milestones;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMilestoneRequest extends FormRequest
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
            'achieved_at' => ['required', 'date'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'photo' => ['nullable', 'image', 'max:8192'],
            // Explicit removal, distinct from "no new file chosen" (which
            // leaves the existing photo untouched) - a plain multipart
            // request can't otherwise say "clear this field".
            'remove_photo' => ['sometimes', 'boolean'],
        ];
    }
}
