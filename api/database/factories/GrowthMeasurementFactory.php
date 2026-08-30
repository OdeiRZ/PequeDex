<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\GrowthMeasurement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GrowthMeasurement>
 */
class GrowthMeasurementFactory extends Factory
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
            'measured_at' => fake()->date(),
            'weight_grams' => fake()->numberBetween(3000, 12000),
            'height_cm' => fake()->randomFloat(1, 48, 90),
            'head_circumference_cm' => fake()->randomFloat(1, 33, 48),
        ];
    }
}
