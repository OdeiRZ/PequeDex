<?php

/*
 * País Vasco: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario vacunal infantil de 2026, Osakidetza / Gobierno Vasco
 * (Manual de vacunaciones, apartado 3.1).
 * https://www.euskadi.eus/contenidos/informacion/manual_vacunaciones/es_def/adjuntos/2026/3.1-Zz-Calendario-vacunal-infantil-de-2026.pdf
 * MenACWY a los 4 y 12 meses; segunda dosis de triple vírica y varicela a
 * los 4 años; dTpa a los 16 años en lugar de Td a los 14.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario vacunal infantil de Euskadi 2026',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'tv_3y' => ['months' => 48, 'age_label' => '4 años'],
        'vvz_3y' => ['months' => 48, 'age_label' => '4 años'],
    ],
    'add' => [
        ['code' => 'dtpa_16y', 'name' => 'dTpa (tétanos, difteria y tosferina)', 'months' => 192, 'age_label' => '16 años'],
    ],
    'remove' => ['td_14y'],
];
