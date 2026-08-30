<?php

namespace Database\Factories;

use App\Enums\FeedType;
use App\Models\Baby;
use App\Models\Feed;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Feed>
 */
class FeedFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'baby_id' => Baby::factory(),
            'user_id' => User::factory(),
            'type' => FeedType::Biberon,
            'amount_ml' => fake()->numberBetween(30, 180),
            'started_at' => fake()->dateTimeBetween('-1 week'),
        ];
    }
}
