<?php

namespace App\Http\Requests\Contractions;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use Illuminate\Foundation\Http\FormRequest;

class UpdateContractionRequest extends FormRequest
{
    // No ValidatesNotBeforeBirth - see StoreContractionRequest.
    use AuthorizesBabyAccess;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'started_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
            'ended_at' => ['nullable', 'date', 'after:started_at', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
            'intensity' => ['required', 'integer', 'between:0,2'],
        ];
    }
}
