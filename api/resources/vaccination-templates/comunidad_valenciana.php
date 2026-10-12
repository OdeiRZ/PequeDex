<?php

/*
 * Comunitat Valenciana: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Resolución de 13 de marzo de 2026, de la Conselleria de Sanidad, por la
 * que se actualiza el calendario de vacunaciones sistemáticas (2026) en la
 * Comunitat Valenciana (DOGV núm. 10328, 24/03/2026).
 * MenACWY a los 4 y 12 meses (desde el 1/4/2026); VNC20 a los 2, 4, 6 y 11
 * meses; segunda dosis de triple vírica y varicela (tetravírica) entre los
 * 2 y 4 años; DTPa-VPI a los 5-6 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de la Comunitat Valenciana (marzo 2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'tv_3y' => ['months' => 24, 'age_label' => '2-4 años'],
        'vvz_3y' => ['months' => 24, 'age_label' => '2-4 años'],
        'dtpa_vpi_6y' => ['age_label' => '5-6 años'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
    ],
    'remove' => [],
];
