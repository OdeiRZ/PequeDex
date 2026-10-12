<?php

/*
 * Canarias: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Orden de 22 de junio de 2026 por la que se aprueba el nuevo Calendario
 * de Inmunizaciones para todas las edades de la vida en Canarias (BOC núm.
 * 140, 14/07/2026). https://www.gobiernodecanarias.org/boc/2026/140/2482.html
 * MenACWY a los 4 y 12 meses; VNC20 3+1 (2, 4, 6 y 11 meses); segunda
 * dosis de triple vírica y varicela (tetravírica) a los 3 años; Tdpa a los
 * 14 años. Rotavirus: 2 o 3 dosis según el preparado.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de inmunizaciones de Canarias (Orden de 22/06/2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'tv_3y' => ['months' => 36, 'age_label' => '3 años'],
        'vvz_3y' => ['months' => 36, 'age_label' => '3 años'],
        'td_14y' => ['name' => 'Tdpa (tétanos, difteria y tosferina)'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
    ],
    'remove' => [],
];
