<?php

namespace App\Http\Requests\Concerns;

/**
 * Shared by every Store/Update request scoped to a baby - checks the
 * authenticated user is actually a caregiver on the route-bound Baby
 * *before* rules() ever runs (Laravel calls authorize() first: see
 * ValidatesWhenResolvedTrait::validateResolved()). Without this, the
 * controller's own $this->authorize('update', $baby) ran too late -
 * ValidatesNotBeforeBirth's rule had already built an after_or_equal
 * message quoting the baby's real birth_date, so an unauthorized user
 * got that date back in the 422 body before ever being rejected
 * (hallazgo de una auditoría de código). The controller's own
 * authorize() call for these methods is redundant now and removed.
 */
trait AuthorizesBabyAccess
{
    public function authorize(): bool
    {
        $baby = $this->route('baby');

        return $baby !== null && $this->user()->can('update', $baby);
    }
}
