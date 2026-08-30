<?php

namespace App\Http\Requests\Concerns;

/**
 * Shared by every Store/Update request that logs something dated - a
 * feed, a diaper change, a growth measurement... none of that makes
 * sense before the baby was actually born. Empty when the baby has no
 * birth_date yet: sex/birth_date are both optional, so there may be
 * nothing to compare against.
 */
trait ValidatesNotBeforeBirth
{
    /**
     * @return array<int, string>
     */
    protected function notBeforeBirthRule(): array
    {
        $birthDate = $this->route('baby')?->birth_date;

        return $birthDate ? ['after_or_equal:'.$birthDate->toDateString()] : [];
    }
}
