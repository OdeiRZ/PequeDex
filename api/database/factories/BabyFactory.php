<?php

namespace Database\Factories;

use App\Models\Baby;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Baby>
 */
class BabyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->firstName(),
            'due_date' => null,
            // Fixed, not fake()->date(): a random birth_date up to "now"
            // could land after the fixed 2026-08-30-ish dates other tests
            // hardcode for feeds/sleeps/etc., which the store/update
            // requests now reject as "before the baby was born".
            'birth_date' => '2020-01-01',
            'invite_code' => Baby::generateInviteCode(),
        ];
    }
}
