<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\Milestone;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Milestone>
 */
class MilestoneFactory extends Factory
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
            'achieved_at' => fake()->date(),
            'title' => fake()->sentence(3),
        ];
    }
}
