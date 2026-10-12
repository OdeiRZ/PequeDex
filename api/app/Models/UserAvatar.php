<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The avatar (a data: URI) lives in its own table instead of a column of
 * users: Sanctum loads the whole users row on every authenticated
 * request, so a ~80 KB avatar in that row was read from the database
 * (and counted against Neon's network transfer) on every request,
 * including the dashboard's polling. Here it is only read when a user is
 * serialized.
 */
class UserAvatar extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = ['user_id', 'data'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
