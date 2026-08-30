<?php

namespace App\Models;

use Database\Factories\MilestoneFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Milestone extends Model
{
    /** @use HasFactory<MilestoneFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'achieved_at', 'title', 'description', 'photo_path'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'achieved_at' => 'date:Y-m-d',
        ];
    }

    protected $appends = ['photo_url'];

    /** Appended to every array/JSON representation (see $appends above) -
     * the frontend only ever needs a servable URL, never the raw disk path. */
    protected function photoUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->photo_path
                ? Storage::disk(config('filesystems.milestones_disk'))->url($this->photo_path)
                : null,
        );
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
