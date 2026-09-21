<?php

namespace App\Http\Requests\Milestones;

use App\Enums\MilestoneCategory;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMilestoneRequest extends FormRequest
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
            'achieved_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', Rule::enum(MilestoneCategory::class)],
            'description' => ['nullable', 'string'],
            // No external source for a baby's own photo (unlike e.g.
            // LudoDex's BGG-sourced game covers) - a real upload, not a
            // pasted URL. 8MB covers a real phone photo without letting a
            // single upload balloon storage.
            'photo' => ['nullable', 'image', 'max:8192'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...$this->dateFieldMessages('achieved_at', 'la fecha del hito'),
            'title.required' => 'Indica un título para el hito.',
            'title.max' => 'El título es demasiado largo (máximo 255 caracteres).',
            'photo.image' => 'El archivo debe ser una imagen.',
            'photo.max' => 'La foto no puede superar los 8 MB.',
        ];
    }
}
