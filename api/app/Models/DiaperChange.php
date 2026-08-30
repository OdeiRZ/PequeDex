<?php

namespace App\Models;

use App\Enums\DiaperType;
use Database\Factories\DiaperChangeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiaperChange extends Model
{
    /** @use HasFactory<DiaperChangeFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'changed_at', 'type', 'notes'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => DiaperType::class,
            'changed_at' => 'datetime',
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
