<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\Temperature;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Temperature>
 */
class TemperatureFactory extends Factory
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
            'measured_at' => fake()->dateTimeBetween('-1 week'),
            'celsius' => 36.8,
        ];
    }
}
