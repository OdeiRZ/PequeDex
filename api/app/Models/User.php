<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\DiaperSize;
use App\Enums\TemperatureMethod;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'action_bar_categories',
        'predictions_enabled',
        'swipe_to_delete_enabled',
        'today_summary_enabled',
        'interaction_feedback_enabled',
        'default_diaper_size',
        'default_feed_duration_minutes',
        'default_temperature_method',
        'sounds_enabled',
        'stats_enabled',
        'alerts_enabled',
        'milestones_enabled',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'avatarRecord',
    ];

    /**
     * `avatar` is not a column (see UserAvatar): it is read from the
     * avatar relation only when the user is serialized, so authenticating
     * a request does not drag the image out of the database.
     *
     * @var list<string>
     */
    protected $appends = ['avatar'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'action_bar_categories' => 'array',
            'predictions_enabled' => 'boolean',
            'swipe_to_delete_enabled' => 'boolean',
            'today_summary_enabled' => 'boolean',
            'interaction_feedback_enabled' => 'boolean',
            'default_diaper_size' => DiaperSize::class,
            'default_feed_duration_minutes' => 'integer',
            'default_temperature_method' => TemperatureMethod::class,
            'sounds_enabled' => 'boolean',
            'stats_enabled' => 'boolean',
            'alerts_enabled' => 'boolean',
            'milestones_enabled' => 'boolean',
        ];
    }

    /**
     * Babies this user is a caregiver on - no admin/owner distinction,
     * every linked caregiver has the same full access (see BabyPolicy).
     *
     * @return BelongsToMany<Baby, $this>
     */
    public function babies(): BelongsToMany
    {
        return $this->belongsToMany(Baby::class)->withTimestamps();
    }

    /**
     * @return HasOne<UserAvatar, $this>
     */
    public function avatarRecord(): HasOne
    {
        return $this->hasOne(UserAvatar::class);
    }

    protected function avatar(): Attribute
    {
        return Attribute::make(get: fn () => $this->avatarRecord?->data);
    }

    /** Stores the avatar (a data: URI) or removes it with null. */
    public function setAvatar(?string $dataUri): void
    {
        if ($dataUri === null) {
            $this->avatarRecord()->delete();
        } else {
            $this->avatarRecord()->updateOrCreate([], ['data' => $dataUri]);
        }

        $this->unsetRelation('avatarRecord');
    }

    /**
     * Send our own branded, translated reset email instead of Laravel's
     * generic default (see App\Notifications\ResetPasswordNotification).
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
