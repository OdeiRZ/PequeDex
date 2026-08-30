<?php

namespace App\Models;

use App\Enums\MilestoneCategory;
use Database\Factories\MilestoneFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Storage;

class Milestone extends Model
{
    /** @use HasFactory<MilestoneFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'achieved_at', 'title', 'category', 'description', 'photo_path'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'achieved_at' => 'date:Y-m-d',
            'category' => MilestoneCategory::class,
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

    /**
     * Caregivers who reacted to this milestone - a single toggleable
     * like per person, not a set of emoji to pick from (see
     * milestone_likes' own migration). Whether *the current* user is
     * among them is left for the frontend to check against auth.user.id
     * rather than a model-level accessor, since a model has no notion of
     * "who's asking".
     *
     * @return BelongsToMany<User, $this>
     */
    public function likedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'milestone_likes')->withTimestamps();
    }
}
