<?php

namespace App\Models;

use App\Enums\BabySex;
use Database\Factories\BabyFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Baby extends Model
{
    /** @use HasFactory<BabyFactory> */
    use HasFactory;

    protected $fillable = ['name', 'due_date', 'birth_date', 'sex', 'invite_code'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_date' => 'date:Y-m-d',
            'birth_date' => 'date:Y-m-d',
            'sex' => BabySex::class,
        ];
    }

    /**
     * Short and typo-resistant (no 0/O/1/I, deliberately not
     * Str::random() - it has no way to restrict the character pool)
     * since it's meant to be read aloud or typed on a phone by whoever
     * is joining. Collisions are checked, not just assumed away by the
     * keyspace being large - the keyspace here (32^8) is comfortably
     * large for this app's real scale, but the check costs one query
     * and removes any doubt.
     */
    public static function generateInviteCode(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (self::where('invite_code', $code)->exists());

        return $code;
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /**
     * @return HasMany<Feed, $this>
     */
    public function feeds(): HasMany
    {
        return $this->hasMany(Feed::class);
    }

    /**
     * @return HasMany<Sleep, $this>
     */
    public function sleeps(): HasMany
    {
        return $this->hasMany(Sleep::class);
    }

    /**
     * @return HasMany<DiaperChange, $this>
     */
    public function diaperChanges(): HasMany
    {
        return $this->hasMany(DiaperChange::class);
    }

    /**
     * @return HasMany<GrowthMeasurement, $this>
     */
    public function growthMeasurements(): HasMany
    {
        return $this->hasMany(GrowthMeasurement::class);
    }

    /**
     * @return HasMany<Milestone, $this>
     */
    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class);
    }
}
