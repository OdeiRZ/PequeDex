<?php

/*
 * Asturias: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Asturias: solo el cambio de meningococo (calendario 2025 de Astursalud,
 * que sustituye MenC por MenACWY; ficha del CAV-AEP de marzo de 2025).
 * No se encontró el calendario oficial 2026; el resto, como el común.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (Asturias, 2025)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
