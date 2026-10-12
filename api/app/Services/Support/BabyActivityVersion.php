<?php

namespace App\Services\Support;

use App\Models\Baby;
use Illuminate\Support\Facades\DB;

/**
 * "Huella" de lo que hay guardado de un bebé: filas, última modificación y
 * último id de cada tabla. Cambia al crear, editar o borrar cualquier
 * registro, y sirve para que el servidor conteste `304` (sin leer ni enviar
 * nada) cuando el móvil ya tiene lo último: la línea temporal del sondeo de
 * 15 s y el arranque del Dashboard.
 *
 * Todas las que se pidan salen de UNA consulta (`UNION ALL`): con la base de
 * datos en otra ciudad cada consulta cuesta ~20 ms, y antes eran cuatro solo
 * para la línea temporal. Se recuerda durante la petición, así que el
 * arranque (que la pide para la línea temporal y para sí mismo) no repite.
 */
class BabyActivityVersion
{
    /** Tablas de actividad que alimentan la línea temporal. */
    public const TIMELINE = ['feeds', 'sleeps', 'diaper_changes', 'temperatures'];

    /** Todo lo que lleva el arranque del Dashboard. */
    public const DASHBOARD = [
        'feeds', 'sleeps', 'diaper_changes', 'temperatures', 'growth_measurements', 'milestones',
        'milestone_likes', 'vitamin_d_schedules', 'vitamin_d_doses', 'vaccinations', 'checkups', 'user_avatars',
    ];

    /**
     * Cada fuente: [FROM ... WHERE, columna de fecha, columna de id, columna
     * a contar como "con foto" o null, ¿lleva el id del bebé?]. Mismas cuatro
     * columnas en todas (c, u, i, p) para poder unirlas.
     *
     * @var array<string, array{0: string, 1: string, 2: string, 3: string|null, 4: bool}>
     */
    private const SOURCES = [
        'feeds' => ['feeds where baby_id = ?', 'updated_at', 'id', null, true],
        'sleeps' => ['sleeps where baby_id = ?', 'updated_at', 'id', null, true],
        'diaper_changes' => ['diaper_changes where baby_id = ?', 'updated_at', 'id', null, true],
        'temperatures' => ['temperatures where baby_id = ?', 'updated_at', 'id', null, true],
        'growth_measurements' => ['growth_measurements where baby_id = ?', 'updated_at', 'id', null, true],
        'milestones' => ['milestones where baby_id = ?', 'updated_at', 'id', 'photo_path', true],
        'milestone_likes' => ['milestone_likes l join milestones m on m.id = l.milestone_id where m.baby_id = ?', 'l.created_at', 'l.milestone_id', null, true],
        'vitamin_d_schedules' => ['baby_vitamin_d_schedules where baby_id = ?', 'updated_at', 'id', null, true],
        'vitamin_d_doses' => ['baby_vitamin_d_doses where baby_id = ?', 'updated_at', 'id', null, true],
        'vaccinations' => ['vaccinations where baby_id = ?', 'updated_at', 'id', null, true],
        'checkups' => ['checkups where baby_id = ?', 'updated_at', 'id', null, true],
        // Los hitos muestran el avatar de quien les dio "me encanta": no es del bebé.
        'user_avatars' => ['user_avatars', 'updated_at', 'user_id', null, false],
    ];

    /**
     * Null si no se pudo calcular: la huella solo es una optimización, así
     * que ante un fallo (se registra) las respuestas salen completas y sin
     * ETag, como antes, en vez de romper el sondeo.
     *
     * @param  list<string>  $keys  Qué tablas incluir (ver TIMELINE y DASHBOARD).
     * @return array<string, array{count: int, updated: string|null, last_id: int|string|null, with_photo: int}>|null
     */
    public static function for(Baby $baby, array $keys): ?array
    {
        try {
            return self::compute($baby, $keys);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
     * @param  list<string>  $keys
     * @return array<string, array{count: int, updated: string|null, last_id: int|string|null, with_photo: int}>
     */
    private static function compute(Baby $baby, array $keys): array
    {
        $memoKey = "baby-activity-version:{$baby->id}";
        $request = request();
        /** @var array<string, array{count: int, updated: string|null, last_id: int|string|null, with_photo: int}> $known */
        $known = $request->attributes->get($memoKey, []);

        $missing = array_values(array_filter($keys, fn (string $key) => ! isset($known[$key])));

        if ($missing !== []) {
            $selects = [];
            $bindings = [];
            foreach ($missing as $key) {
                [$from, $updated, $id, $photo, $perBaby] = self::SOURCES[$key];
                $photoColumn = $photo === null ? '0' : "count({$photo})";
                $selects[] = "select '{$key}' as k, count(*) as c, max({$updated}) as u, max({$id}) as i, {$photoColumn} as p from {$from}";
                if ($perBaby) {
                    $bindings[] = $baby->id;
                }
            }

            foreach (DB::select(implode(' union all ', $selects), $bindings) as $row) {
                $known[$row->k] = [
                    'count' => (int) $row->c,
                    'updated' => $row->u === null ? null : (string) $row->u,
                    'last_id' => $row->i,
                    'with_photo' => (int) $row->p,
                ];
            }
            $request->attributes->set($memoKey, $known);
        }

        return array_intersect_key($known, array_flip($keys));
    }
}
