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
            // after_or_equal, not after: the frontend's datetime-local
            // inputs only have minute precision, so a contraction that
            // genuinely lasts under a minute can end up with started_at
            // === ended_at once edited - a strict "after" rejected that
            // as invalid even though it's a real, short contraction.
            'ended_at' => ['nullable', 'date', 'after_or_equal:started_at', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
            'intensity' => ['required', 'integer', 'between:0,2'],
        ];
    }
}
