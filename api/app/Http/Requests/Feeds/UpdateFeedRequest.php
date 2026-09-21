<?php

namespace App\Http\Requests\Feeds;

use App\Enums\FeedSide;
use App\Enums\FeedType;
use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Same shape as StoreFeedRequest, not a partial `sometimes` update - the
 * side/amount_ml pair depends on `type`, which the store side already
 * needs fully validated together, so an edit sends the whole row back
 * rather than a partial patch.
 */
class UpdateFeedRequest extends FormRequest
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
            'type' => ['required', Rule::enum(FeedType::class)],
            'side' => ['required_if:type,'.FeedType::Pecho->value, 'prohibited_unless:type,'.FeedType::Pecho->value, Rule::enum(FeedSide::class)],
            'amount_ml' => ['required_if:type,'.FeedType::Biberon->value, 'prohibited_unless:type,'.FeedType::Biberon->value, 'integer', 'min:1'],
            'started_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toDateTimeString(), ...$this->notBeforeBirthRule()],
            'ended_at' => ['nullable', 'date', 'after:started_at', 'before_or_equal:'.now()->addMinute()->toDateTimeString()],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Selecciona el tipo de toma.',
            'side.required_if' => 'Selecciona el lado.',
            'side.prohibited_unless' => 'El lado solo aplica a las tomas de pecho.',
            'amount_ml.required_if' => 'Indica la cantidad en ml.',
            'amount_ml.prohibited_unless' => 'La cantidad en ml solo aplica a las tomas de biberón.',
            'amount_ml.min' => 'La cantidad debe ser de al menos 1 ml.',
            ...$this->dateFieldMessages('started_at', 'la hora de inicio'),
            'ended_at.date' => 'La hora de fin no es una fecha válida.',
            'ended_at.after' => 'La hora de fin debe ser posterior a la hora de inicio.',
            'ended_at.before_or_equal' => 'La hora de fin no puede ser posterior al momento actual.',
        ];
    }
}
