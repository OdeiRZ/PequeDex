<?php

namespace App\Enums;

/**
 * Only meaningful when there's actually something to look at - see
 * StoreDiaperChangeRequest/UpdateDiaperChangeRequest for the
 * prohibited_if rule that keeps this null for a purely wet change
 * (DiaperType::Mojado).
 */
enum DiaperResidueColor: string
{
    case Verde = 'verde';
    case Amarillo = 'amarillo';
    case Marron = 'marron';
    case Meconio = 'meconio';
}
