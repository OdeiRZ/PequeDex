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
        // Una misma petición puede comprobar esto varias veces (el arranque
        // del Dashboard llama a 10 controladores, cada uno con su
        // authorize): con la base de datos en otra ciudad cada consulta
        // repetida cuesta ~20 ms, así que se recuerda durante la petición.
        $request = request();
        $key = "baby-view:{$baby->id}:{$user->id}";

        if (! $request->attributes->has($key)) {
            $request->attributes->set($key, $baby->users()->whereKey($user->id)->exists());
        }

        return (bool) $request->attributes->get($key);
    }

    public function update(User $user, Baby $baby): bool
    {
        return $baby->users()->whereKey($user->id)->exists();
    }
}
