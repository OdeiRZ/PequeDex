<?php

namespace App\Http\Requests\Milestones;

use App\Enums\MilestoneCategory;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMilestoneRequest extends FormRequest
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
            'achieved_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', Rule::enum(MilestoneCategory::class)],
            'description' => ['nullable', 'string'],
            'photo' => ['nullable', 'image', 'max:8192'],
            // Explicit removal, distinct from "no new file chosen" (which
            // leaves the existing photo untouched) - a plain multipart
            // request can't otherwise say "clear this field".
            'remove_photo' => ['sometimes', 'boolean'],
        ];
    }
}
