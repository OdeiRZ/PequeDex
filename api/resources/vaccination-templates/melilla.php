<?php

/*
 * Melilla: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Melilla: solo el cambio de meningococo (MenACWY a los 4 y 12 meses según
 * la ficha del CAV-AEP y su nota sobre 2026). Melilla incluye además la
 * hepatitis A en su calendario infantil, pero no se encontró una fuente
 * oficial legible con las edades, así que no se añade: se puede añadir a
 * mano.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (Melilla, CAV-AEP)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
