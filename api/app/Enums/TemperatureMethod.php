<?php

namespace App\Enums;

/**
 * Dónde se tomó la temperatura - opcional, pero cambia cómo se lee la
 * cifra (la rectal suele dar algo más que la axilar), así que se guarda
 * para que el pediatra lo sepa si pregunta.
 */
enum TemperatureMethod: string
{
    case Axila = 'axila';
    case Recto = 'recto';
    case Oido = 'oido';
    case Frente = 'frente';
}
