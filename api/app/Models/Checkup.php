<?php

namespace App\Models;

use Database\Factories\CheckupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una revisión con el pediatra o la enfermera, añadida a mano - no hay
 * plantilla: cada comunidad tiene su propio programa de revisiones y la
 * fecha real la da el centro de salud.
 */
class Checkup extends Model
{
    /** @use HasFactory<CheckupFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'scheduled_at', 'reason', 'notes'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
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
