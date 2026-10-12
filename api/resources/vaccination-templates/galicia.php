<?php

/*
 * Galicia: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Calendario de inmunización a lo largo de toda la vida, Programa gallego
 * de vacunación (1 de junio de 2026), Consellería de Sanidade.
 * https://extranet.sergas.es/catpb/Docs/cas/Publicaciones/Docs/SaludPublica/PDF-3364-es.pdf
 * MenACWY a los 4 y 12 meses; meningococo B también a los 12 años; VNC
 * con dosis a los 6 meses; segunda dosis de triple vírica y varicela
 * (tetravírica) a los 2 años.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario de vacunación de Galicia (junio 2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
        'tv_3y' => ['months' => 24, 'age_label' => '2 años'],
        'vvz_3y' => ['months' => 24, 'age_label' => '2 años'],
    ],
    'add' => [
        ['code' => 'vnc_6m', 'name' => 'Neumococo (VNC)', 'months' => 6, 'age_label' => '6 meses'],
        ['code' => 'menb_12y', 'name' => 'Meningococo B', 'months' => 144, 'age_label' => '12 años'],
    ],
    'remove' => [],
];
