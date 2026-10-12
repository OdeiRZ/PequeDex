<?php

/*
 * Aragón: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Aragón: solo el cambio de meningococo, contrastado en la ficha del CAV-AEP
 * (https://vacunasaep.org/profesionales/calendario-vacunas/aragon) y en la
 * nota del CAV-AEP sobre el calendario 2026 (MenACWY a los 4 y 12 meses en
 * todas las comunidades salvo Cataluña, Navarra y Madrid). No se encontró
 * el calendario oficial 2026 legible; el resto, como el común.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (Aragón, CAV-AEP)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
