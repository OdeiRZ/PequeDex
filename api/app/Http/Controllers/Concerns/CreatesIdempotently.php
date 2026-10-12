<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Baby;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

        return response()->json(['data' => $relation->create($attributes)], 201);
    }
}
