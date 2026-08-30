<?php

namespace Database\Factories;

use App\Enums\DiaperType;
use App\Models\Baby;
use App\Models\DiaperChange;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DiaperChange>
 */
class DiaperChangeFactory extends Factory
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
            'changed_at' => fake()->dateTimeBetween('-1 week'),
            'type' => DiaperType::Mojado,
        ];
    }
}
