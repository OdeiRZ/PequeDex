<?php

namespace App\Enums;

/**
 * Nullable on the model - "otro" isn't a silent fallback for "nobody
 * picked one", it's its own real choice (a milestone that just doesn't
 * fit the common ones). Emoji per category are chosen in the frontend
 * (MilestoneCard.vue et al.), not here - this enum only needs to know
 * what the valid values are.
 */
enum MilestoneCategory: string
{
    case Sonrisa = 'sonrisa';
    case Diente = 'diente';
    case Pasos = 'pasos';
    case Palabra = 'palabra';
    case Otro = 'otro';
}
