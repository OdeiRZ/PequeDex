<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\Sleep;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sleep>
 */
class SleepFactory extends Factory
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
            'started_at' => fake()->dateTimeBetween('-1 week'),
        ];
    }
}
