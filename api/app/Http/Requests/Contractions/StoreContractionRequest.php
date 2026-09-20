<?php

namespace App\Http\Requests\Contractions;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use Illuminate\Foundation\Http\FormRequest;

class StoreContractionRequest extends FormRequest
{
    // Deliberately no ValidatesNotBeforeBirth here, unlike every other
    // Store*Request in this app - a contraction is logged precisely
    // *before* birth_date is set (that's the whole point of this
    // screen), so requiring after_or_equal:birth_date would be backwards.
    use AuthorizesBabyAccess;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Optional: the normal "Inicio de contracción" tap sends no
            // body at all, the controller defaults to now() - this only
            // matters if a caller ever wants to backdate the start.
            'started_at' => ['sometimes', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
        ];
    }
}
