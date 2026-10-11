<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\Checkup;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Checkup>
 */
class CheckupFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'baby_id' => Baby::factory(),
            'user_id' => User::factory(),
            'scheduled_at' => fake()->dateTimeBetween('now', '+1 month'),
            'reason' => 'Revisión de los 2 meses',
        ];
    }
}
