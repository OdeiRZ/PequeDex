<?php

/*
 * Extremadura: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Resolución de actualización del calendario común de vacunaciones e
 * inmunizaciones a lo largo de toda la vida de Extremadura (DOE núm. 18,
 * 28/01/2026). https://doe.juntaex.es/pdfs/doe/2026/180o/26060202.pdf
 * MenACWY a los 4 y 12 meses; VNC a los 2, 4, 6 y 11 meses; rotavirus en
 * 3 dosis (2, 4 y 6 meses); segunda dosis de triple vírica y varicela
 * (tetravírica) a los 4 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de Extremadura (DOE 28/01/2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'tv_3y' => ['months' => 48, 'age_label' => '4 años'],
        'vvz_3y' => ['months' => 48, 'age_label' => '4 años'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
        ['code' => 'rv_3', 'name' => 'Rotavirus (3.ª dosis)', 'months' => 6, 'age_label' => '6 meses'],
    ],
    'remove' => [],
];
