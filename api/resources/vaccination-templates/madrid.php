<?php

/*
 * Comunidad de Madrid: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario de vacunación e inmunización para toda la vida, Comunidad de
 * Madrid 2026: "A partir del 1 de enero del 2026 se sustituye la vacunación
 * con MenC por MenACWY a los 12 meses de edad". A los 4 meses sigue MenC.
 * https://gestiona3.madrid.org/bvirtual/BVCM051747.pdf
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunación de la Comunidad de Madrid 2026',
    'year' => 2026,
    'replace' => [
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
