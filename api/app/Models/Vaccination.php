<?php

namespace App\Models;

use Database\Factories\VaccinationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vaccination extends Model
{
    /** @use HasFactory<VaccinationFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'code', 'name', 'age_label', 'due_date', 'given_at', 'optional', 'notes', 'edited', 'due_date_edited'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_date' => 'date:Y-m-d',
            'given_at' => 'date:Y-m-d',
            'optional' => 'boolean',
            'edited' => 'boolean',
            'due_date_edited' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Baby, $this>
     */
    public function baby(): BelongsTo
    {
        return $this->belongsTo(Baby::class);
    }
}
