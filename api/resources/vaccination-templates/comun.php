<?php

/*
 * Calendario común de vacunación e inmunización a lo largo de toda la
 * vida, calendario recomendado año 2026 - Consejo Interterritorial del
 * SNS, aprobado el 12 de diciembre de 2025. Solo la parte infantil y
 * adolescente (0-14 años).
 * https://www.sanidad.gob.es/areas/promocionPrevencion/vacunaciones/calendario/docs/CalendarioVacunacion_Todalavida.pdf
 *
 * `months`: edad en meses a la que se calcula la fecha prevista desde
 * la fecha de nacimiento. `optional`: solo en determinados casos o por
 * temporada - no cuenta como pendiente. El rotavirus va "según ficha
 * técnica" (2 o 3 dosis según la vacuna); se plantean 2 y se puede
 * editar o añadir otra a mano.
 *
 * Cuando el Consejo Interterritorial publique un calendario nuevo, se
 * actualiza este fichero (y `source`/`year`); los bebés ya generados no
 * se tocan solos.
 */
return [
    'source' => 'Calendario común del Consejo Interterritorial del SNS',
    'year' => 2026,
    'items' => [
        ['code' => 'hb_birth', 'name' => 'Hepatitis B (al nacer)', 'months' => 0, 'age_label' => 'Al nacer', 'optional' => true, 'notes' => 'Solo si la madre es portadora de hepatitis B o no se le hizo el cribado.'],
        ['code' => 'vrs', 'name' => 'VRS (anticuerpo monoclonal)', 'months' => 0, 'age_label' => 'Temporada de VRS, menores de 6 meses', 'optional' => true],

        ['code' => 'hexa_2m', 'name' => 'Hexavalente (DTPa-VPI-Hib-HB)', 'months' => 2, 'age_label' => '2 meses'],
        ['code' => 'vnc_2m', 'name' => 'Neumococo (VNC)', 'months' => 2, 'age_label' => '2 meses'],
        ['code' => 'menb_2m', 'name' => 'Meningococo B', 'months' => 2, 'age_label' => '2 meses'],
        ['code' => 'rv_1', 'name' => 'Rotavirus (1.ª dosis)', 'months' => 2, 'age_label' => '2 meses'],

        ['code' => 'hexa_4m', 'name' => 'Hexavalente (DTPa-VPI-Hib-HB)', 'months' => 4, 'age_label' => '4 meses'],
        ['code' => 'vnc_4m', 'name' => 'Neumococo (VNC)', 'months' => 4, 'age_label' => '4 meses'],
        ['code' => 'menb_4m', 'name' => 'Meningococo B', 'months' => 4, 'age_label' => '4 meses'],
        ['code' => 'men_4m', 'name' => 'Meningococo C', 'months' => 4, 'age_label' => '4 meses'],
        ['code' => 'rv_2', 'name' => 'Rotavirus (2.ª dosis)', 'months' => 4, 'age_label' => '4 meses'],

        ['code' => 'gripe', 'name' => 'Gripe (temporada)', 'months' => 6, 'age_label' => 'De 6 a 59 meses, cada temporada', 'optional' => true],

        ['code' => 'hexa_11m', 'name' => 'Hexavalente (DTPa-VPI-Hib-HB)', 'months' => 11, 'age_label' => '11 meses'],
        ['code' => 'vnc_11m', 'name' => 'Neumococo (VNC)', 'months' => 11, 'age_label' => '11 meses'],

        ['code' => 'tv_12m', 'name' => 'Triple vírica (sarampión, rubeola, paperas)', 'months' => 12, 'age_label' => '12 meses'],
        ['code' => 'menb_12m', 'name' => 'Meningococo B', 'months' => 12, 'age_label' => '12 meses'],
        ['code' => 'men_12m', 'name' => 'Meningococo C', 'months' => 12, 'age_label' => '12 meses'],

        ['code' => 'vvz_15m', 'name' => 'Varicela', 'months' => 15, 'age_label' => '15 meses'],

        ['code' => 'tv_3y', 'name' => 'Triple vírica (sarampión, rubeola, paperas)', 'months' => 36, 'age_label' => '3-4 años'],
        ['code' => 'vvz_3y', 'name' => 'Varicela', 'months' => 36, 'age_label' => '3-4 años'],

        ['code' => 'dtpa_vpi_6y', 'name' => 'DTPa-VPI', 'months' => 72, 'age_label' => '6 años'],

        ['code' => 'menacwy_12y', 'name' => 'Meningococo ACWY', 'months' => 144, 'age_label' => '12 años'],
        ['code' => 'vph_12y', 'name' => 'Virus del papiloma humano (VPH)', 'months' => 144, 'age_label' => '12 años'],

        ['code' => 'td_14y', 'name' => 'Tétanos-difteria (Td)', 'months' => 168, 'age_label' => '14 años'],
    ],
];
