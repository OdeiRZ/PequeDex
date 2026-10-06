<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\DiaperSize;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
        'avatar',
        'action_bar_categories',
        'predictions_enabled',
        'swipe_to_delete_enabled',
        'today_summary_enabled',
        'interaction_feedback_enabled',
        'default_diaper_size',
        'default_feed_duration_minutes',
        'sounds_enabled',
        'stats_enabled',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

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
            'sounds_enabled' => 'boolean',
            'stats_enabled' => 'boolean',
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
     * Send our own branded, translated reset email instead of Laravel's
     * generic default (see App\Notifications\ResetPasswordNotification).
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
