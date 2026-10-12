<?php

/*
 * Navarra: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Navarra: MenC a los 4 meses y MenACWY a los 12 (nacidos desde el
 * 1/1/2023), según la ficha del CAV-AEP y su nota sobre 2026 (Cataluña,
 * Navarra y Madrid son las únicas que no la ponen a los 4 meses). No se
 * encontró el calendario oficial 2026; el resto, como el común.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 12 meses (Navarra, CAV-AEP)',
    'year' => 2026,
    'replace' => [
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
