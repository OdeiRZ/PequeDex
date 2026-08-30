<?php

namespace App\Http\Requests\Feeds;

use App\Enums\FeedSide;
use App\Enums\FeedType;
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
            'side' => ['required_if:type,'.FeedType::Pecho->value, 'prohibited_unless:type,'.FeedType::Pecho->value, Rule::enum(FeedSide::class)],
            'amount_ml' => ['required_if:type,'.FeedType::Biberon->value, 'prohibited_unless:type,'.FeedType::Biberon->value, 'integer', 'min:1'],
            'started_at' => ['required', 'date', ...$this->notBeforeBirthRule()],
            'ended_at' => ['nullable', 'date', 'after:started_at'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
