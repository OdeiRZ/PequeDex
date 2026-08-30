<?php

namespace App\Enums;

enum DiaperType: string
{
    case Mojado = 'mojado';
    case Sucio = 'sucio';
    case Ambos = 'ambos';
}
