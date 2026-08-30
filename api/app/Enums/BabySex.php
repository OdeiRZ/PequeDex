<?php

namespace App\Enums;

enum BabySex: string
{
    case Nino = 'nino';
    case Nina = 'nina';

    /** The WHO growth-standard tables are published under these keys. */
    public function whoTableKey(): string
    {
        return match ($this) {
            self::Nino => 'boy',
            self::Nina => 'girl',
        };
    }
}
