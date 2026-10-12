<?php

/*
 * Castilla y León: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario de vacunaciones e inmunizaciones para toda la vida, Castilla y
 * León 2026 (Orden SAN/209/2026, de 3 de marzo; en vigor el 1/4/2026).
 * https://www.saludcastillayleon.es/profesionales/es/vacunaciones/calendario-vacunaciones-inmunizaciones-toda-vida-cas-17a609
 * MenACWY a los 4 y 12 meses; VNC20 a los 2, 4, 6 y 11 meses; rotavirus
 * a los 2 y 3 meses, y a los 4 meses solo con la vacuna de 3 dosis.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de Castilla y León (Orden SAN/209/2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'rv_2' => ['months' => 3, 'age_label' => '3 meses'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
        ['code' => 'rv_3', 'name' => 'Rotavirus (3.ª dosis)', 'months' => 4, 'age_label' => '4 meses', 'optional' => true, 'notes' => 'Solo si la vacuna usada es de 3 dosis.'],
    ],
    'remove' => [],
];
