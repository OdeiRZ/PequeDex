<?php

namespace App\Models;

use Database\Factories\VitaminDScheduleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VitaminDSchedule extends Model
{
    /** @use HasFactory<VitaminDScheduleFactory> */
    use HasFactory;

    protected $table = 'baby_vitamin_d_schedules';

    protected $fillable = ['baby_id', 'user_id', 'enabled', 'start_date', 'end_date'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
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
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
