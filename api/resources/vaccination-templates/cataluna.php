<?php

/*
 * Cataluña: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendari de vacunacions i immunitzacions sistemàtiques 2025 (Departament
 * de Salut), vigente en 2026 según Canal Salut.
 * https://canalsalut.gencat.cat/web/.content/_A-Z/V/vacunacions/documents/calendari_vacunacions.pdf
 * MenC a los 4 meses y MenACWY a los 12; hepatitis A a los 15 meses y 6
 * años; MenACWY, VPH y dTpa a los 11-12 años (la dTpa sustituye a la Td
 * de los 14 años).
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendari de vacunacions de Catalunya (2025, vigente en 2026)',
    'year' => 2026,
    'replace' => [
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'menacwy_12y' => ['months' => 132, 'age_label' => '11-12 años'],
        'vph_12y' => ['months' => 132, 'age_label' => '11-12 años'],
    ],
    'add' => [
        ['code' => 'hepa_15m', 'name' => 'Hepatitis A', 'months' => 15, 'age_label' => '15 meses'],
        ['code' => 'hepa_6y', 'name' => 'Hepatitis A', 'months' => 72, 'age_label' => '6 años'],
        ['code' => 'dtpa_11y', 'name' => 'dTpa (tétanos, difteria y tosferina)', 'months' => 132, 'age_label' => '11-12 años'],
    ],
    'remove' => ['td_14y'],
];
