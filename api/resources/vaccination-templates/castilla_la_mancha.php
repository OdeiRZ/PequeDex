<?php

/*
 * Castilla-La Mancha: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Documento técnico del calendario de vacunaciones sistemáticas 2026 de
 * Castilla-La Mancha (Resolución de 14/11/2025, en vigor el 1/1/2026).
 * https://sanidad.castillalamancha.es/sites/sescam.castillalamancha.es/files/documentos/pdf/20260107/20251230_documento_tecnico_calendario_sistematico_2026.pdf
 * MenACWY a los 4 y 12 meses; VNC20 a los 2, 4, 6 y 11 meses; rotavirus
 * (RotaTeq) a los 2, 4 y 6 meses; segunda dosis de triple vírica y
 * varicela (tetravírica) a los 4 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunaciones de Castilla-La Mancha 2026',
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
