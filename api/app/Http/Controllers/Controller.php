<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    use AuthorizesRequests;

    /**
     * Techo de filas de los listados de registros (tomas, sueños, pañales,
     * temperaturas), de las más recientes a las más antiguas. Estadísticas pide
     * el historial entero; con ~10 registros al día esto son más de cinco años,
     * y evita que una cuenta enorme sature la instancia con una sola petición.
     */
    public const INDEX_LIMIT = 20000;
}
