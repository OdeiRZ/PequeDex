<?php

/*
 * Andalucía: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario Sistemático de Vacunaciones e Inmunizaciones de Andalucía 2026
 * (Andavac, Junta de Andalucía), actualizado en enero de 2026.
 * https://www.andavac.es/wp-content/uploads/calendario/Calendario-Vacunaciones-2026-Andalucia-leyenda.pdf
 * MenACWY en vez de MenC a los 4 y 12 meses; meningococo B a los 2, 4 y
 * 15 meses (no 12); VNC20 con dosis a los 6 meses; segunda dosis de triple
 * vírica y varicela a los 2-3 años (en 2026 a los nacidos en 2023 y 2024);
 * Tdpa a los 14 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de Andalucía (enero 2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'menb_12m' => ['months' => 15, 'age_label' => '15 meses'],
        'tv_3y' => ['months' => 24, 'age_label' => '2-3 años'],
        'vvz_3y' => ['months' => 24, 'age_label' => '2-3 años'],
        'td_14y' => ['name' => 'Tdpa (tétanos, difteria y tosferina)'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
    ],
    'remove' => [],
];
