<?php

/*
 * Ceuta: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Ceuta: solo el cambio de meningococo (ficha del CAV-AEP, enero de 2025:
 * "a partir del 15 de enero de 2025 se sustituye MenC por MenACWY a los 4
 * y 12 meses"). Ceuta incluye además la hepatitis A en su calendario
 * infantil, pero no se encontró una fuente oficial legible con las edades,
 * así que no se añade: se puede añadir a mano.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (Ceuta, CAV-AEP 2025)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
