<?php

/*
 * La Rioja: el calendario común (comun.php) más lo que cambia aquí.
 *
 * La Rioja: actualización del calendario de inmunización (junio 2024,
 * Servicio de Epidemiología y Prevención Sanitaria): MenACWY a los 4
 * meses en sustitución de MenC (nacidos desde el 1/3/2024), además de la
 * dosis de los 12 meses que ya era MenACWY. Rotavirus a los 2 y 4 meses,
 * como el común. Sigue así en la nota del CAV-AEP sobre 2026.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (La Rioja)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
