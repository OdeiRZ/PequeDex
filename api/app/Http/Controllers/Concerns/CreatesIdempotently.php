<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Baby;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;

/**
 * Para los registros que el móvil puede crear sin conexión (tomas,
 * sueños, pañales, temperaturas): si la petición trae un `client_uuid`
 * que ya existe para este bebé, es un reintento de un envío que sí llegó
 * (la respuesta se perdió por el camino) - se devuelve el registro que
 * ya hay (200) en vez de crear otro igual. Sin `client_uuid`, crea como
 * siempre (201).
 */
trait CreatesIdempotently
{
    /**
     * @template TModel of Model
     *
     * @param  HasMany<TModel, Baby>  $relation
     * @param  array<string, mixed>  $attributes
     */
    protected function createOnce(HasMany $relation, array $attributes): JsonResponse
    {
        $clientUuid = $attributes['client_uuid'] ?? null;

        if ($clientUuid !== null) {
            $existing = (clone $relation)->where('client_uuid', $clientUuid)->first();
            if ($existing !== null) {
                return response()->json(['data' => $existing]);
            }
        }

        try {
            return response()->json(['data' => $relation->create($attributes)], 201);
        } catch (UniqueConstraintViolationException $e) {
            // Carrera: "mirar si existe" y "crear" no son atómicos, y dos peticiones
            // con el mismo `client_uuid` pueden llegar a la vez (el móvil agotó el
            // tiempo de la primera y reenvió la misma alta desde la cola mientras
            // el servidor aún la estaba procesando). La que pierde choca con la
            // restricción única; el resultado correcto es el mismo que el del
            // reintento de arriba: devolver el registro que ya existe.
            $existing = $clientUuid === null ? null : (clone $relation)->where('client_uuid', $clientUuid)->first();

            if ($existing === null) {
                throw $e; // otra restricción única, no la del reintento: no se esconde
            }

            return response()->json(['data' => $existing]);
        }
    }
}
