<?php

namespace App\Models;

use Database\Factories\GrowthMeasurementFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GrowthMeasurement extends Model
{
    /** @use HasFactory<GrowthMeasurementFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'measured_at', 'weight_grams', 'height_cm', 'head_circumference_cm', 'notes'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'measured_at' => 'date:Y-m-d',
            'height_cm' => 'float',
            'head_circumference_cm' => 'float',
        ];
    }

    /**
     * @return BelongsTo<Baby, $this>
     */
    public function baby(): BelongsTo
    {
        return $this->belongsTo(Baby::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function loggedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
