<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\User;
use App\Models\VitaminDDose;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VitaminDDose>
 */
class VitaminDDoseFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'baby_id' => Baby::factory(),
            'user_id' => User::factory(),
            'date' => fake()->date(),
            'given' => true,
        ];
    }
}
