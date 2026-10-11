<?php

/*
 * Cantabria: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Instrucción sobre la sustitución de la vacuna Men C por Men ACWY en el
 * calendario de vacunación a lo largo de la vida de Cantabria - Dirección
 * General de Salud Pública, firmada el 23/01/2026. Desde el 1 de febrero
 * de 2026, la vacuna frente a meningococo C de los 4 y 12 meses pasa a
 * ser MenACWY.
 * https://www.scsalud.es/documents/20117/179286/INSTRUCCION%20SOBRE%20LA%20VACUNACION%20FRENTE%20A%20MENINGOCOCO.report.pdf/40ea149c-8349-ba56-3e63-b8a67f4570e0
 *
 * `replace`: código de la plantilla común => campos que cambian.
 * `add`/`remove` existen para futuras comunidades con vacunas propias.
 */
return [
    'source' => 'Calendario común + instrucción de Salud Pública de Cantabria (23/01/2026)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
