<?php

namespace Database\Factories;

use App\Models\Baby;
use App\Models\Vaccination;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vaccination>
 */
class VaccinationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'baby_id' => Baby::factory(),
            'name' => 'Hexavalente (DTPa-VPI-Hib-HB)',
            'age_label' => '2 meses',
            'due_date' => fake()->dateTimeBetween('now', '+2 months')->format('Y-m-d'),
        ];
    }
}
