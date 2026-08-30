<?php

namespace App\Policies;

use App\Models\Baby;
use App\Models\User;

/**
 * No admin/owner distinction - every caregiver linked to a baby has full
 * read/write access to it and everything under it (feeds, sleeps, diaper
 * changes), regardless of who logged what or who created the baby in the
 * first place. Controllers for those child resources authorize against
 * the parent Baby via this same policy (e.g. $this->authorize('update', $baby)
 * before creating/editing a Feed) rather than having their own policies,
 * since visibility/write-access is scoped by baby membership, never by
 * who logged an individual event.
 */
class BabyPolicy
{
    public function view(User $user, Baby $baby): bool
    {
        return $baby->users()->whereKey($user->id)->exists();
    }

    public function update(User $user, Baby $baby): bool
    {
        return $baby->users()->whereKey($user->id)->exists();
    }
}
