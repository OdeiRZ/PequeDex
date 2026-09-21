<?php

namespace App\Http\Requests\Concerns;

/**
 * Shared by every Store/Update request with a "when did this happen"
 * field - without this, a failed `before_or_equal`/`after_or_equal` rule
 * falls back to Laravel's generic translator, which (for `after_or_equal`
 * comparing to another field, as `notBeforeBirthRule()` does) resolves
 * the compared value through the `attributes` map too - "no es una fecha
 * posterior o igual a fecha" reads as broken English translated
 * literally, not a real sentence a caregiver would understand. `$label`
 * is the field's name as it appears mid-sentence, articled and
 * lowercase ("la hora de inicio", "la fecha de la medida"), so it slots
 * into each message directly.
 */
trait HasDateFieldMessages
{
    /**
     * @return array<string, string>
     */
    protected function dateFieldMessages(string $field, string $label): array
    {
        return [
            "{$field}.required" => "Indica {$label}.",
            "{$field}.date" => ucfirst($label).' no es una fecha válida.',
            "{$field}.before_or_equal" => ucfirst($label).' no puede ser posterior al momento actual.',
            "{$field}.after_or_equal" => ucfirst($label).' no puede ser anterior al nacimiento del bebé.',
        ];
    }
}
