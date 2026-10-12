<?php

/*
 * Región de Murcia: el calendario común (comun.php) más lo que cambia aquí.
 *
 * Región de Murcia: solo el cambio de meningococo (ficha del CAV-AEP: los
 * nacidos desde el 20/02/2024 reciben MenACWY a los 4 meses; la dosis de
 * los 12 meses ya lo era). El calendario 2026 (Orden de 21/09/2026, BORM
 * 29/09/2026) no se pudo leer; el resto, como el común.
 *
 * Recopilado en 2026: si la comunidad cambia su calendario, se actualiza
 * este fichero (y `source`/`year`).
 */
return [
    'source' => 'Calendario común + MenACWY a los 4 y 12 meses (Murcia, CAV-AEP)',
    'year' => 2026,
    'replace' => [
        'men_4m' => ['name' => 'Meningococo ACWY'],
        'men_12m' => ['name' => 'Meningococo ACWY'],
    ],
    'add' => [],
    'remove' => [],
];
