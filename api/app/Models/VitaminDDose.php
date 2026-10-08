<?php

namespace App\Models;

use Database\Factories\VitaminDDoseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VitaminDDose extends Model
{
    /** @use HasFactory<VitaminDDoseFactory> */
    use HasFactory;

    protected $table = 'baby_vitamin_d_doses';

    protected $fillable = ['baby_id', 'user_id', 'date', 'given'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'given' => 'boolean',
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
