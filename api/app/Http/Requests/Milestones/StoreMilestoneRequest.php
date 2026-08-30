<?php

namespace App\Http\Requests\Milestones;

use Illuminate\Foundation\Http\FormRequest;

class StoreMilestoneRequest extends FormRequest
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
            // No external source for a baby's own photo (unlike e.g.
            // LudoDex's BGG-sourced game covers) - a real upload, not a
            // pasted URL. 8MB covers a real phone photo without letting a
            // single upload balloon storage.
            'photo' => ['nullable', 'image', 'max:8192'],
        ];
    }
}
