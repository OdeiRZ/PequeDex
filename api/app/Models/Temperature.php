<?php

namespace App\Models;

use App\Enums\TemperatureMethod;
use Database\Factories\TemperatureFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Temperature extends Model
{
    /** @use HasFactory<TemperatureFactory> */
    use HasFactory;

    protected $fillable = ['client_uuid', 'baby_id', 'user_id', 'measured_at', 'celsius', 'method', 'notes'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'method' => TemperatureMethod::class,
            'measured_at' => 'datetime',
            // `float`, no el `decimal:1` de Eloquent (que serializa como
            // string "37.5") - el frontend la trata como número.
            'celsius' => 'float',
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
