<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\User;
use App\Models\VitaminDSchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VitaminDSchedule>
 */
class VitaminDScheduleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = fake()->dateTimeBetween('-6 months', 'now');

        return [
            'baby_id' => Baby::factory(),
            'user_id' => User::factory(),
            'enabled' => true,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => (clone $startDate)->modify('+1 year')->format('Y-m-d'),
        ];
    }
}
