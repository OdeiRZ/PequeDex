<?php

namespace App\Http\Requests\Feeds;

use App\Enums\FeedSide;
use App\Enums\FeedType;
use App\Http\Requests\Concerns\ValidatesNotBeforeBirth;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFeedRequest extends FormRequest
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
            'type' => ['required', Rule::enum(FeedType::class)],
            // side/amount_ml are each required for exactly one FeedType
            // and prohibited for every other one - a bottle feed has no
            // side, a breastfeed has no ml amount.
            'side' => ['required_if:type,'.FeedType::Pecho->value, 'prohibited_unless:type,'.FeedType::Pecho->value, Rule::enum(FeedSide::class)],
            'amount_ml' => ['required_if:type,'.FeedType::Biberon->value, 'prohibited_unless:type,'.FeedType::Biberon->value, 'integer', 'min:1'],
            'started_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            'ended_at' => ['nullable', 'date', 'after:started_at'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
