<?php

/*
 * Illes Balears: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario sistemático de vacunaciones e inmunizaciones a lo largo de toda
 * la vida, Illes Balears 2026 (V2, marzo 2026), Conselleria de Salut.
 * https://www.caib.es/sites/vacunacions/f/495018
 * MenACWY a los 4 y 12 meses; VNC20 con dosis a los 6 meses; rotavirus
 * en 3 dosis (2, 4 y 6 meses); dTpa a los 14 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de Illes Balears (marzo 2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'td_14y' => ['name' => 'dTpa (tétanos, difteria y tosferina)'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
        ['code' => 'rv_3', 'name' => 'Rotavirus (3.ª dosis)', 'months' => 6, 'age_label' => '6 meses'],
    ],
    'remove' => [],
];
