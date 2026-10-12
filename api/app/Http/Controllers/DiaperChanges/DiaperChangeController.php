<?php

namespace App\Http\Controllers\DiaperChanges;

use App\Http\Controllers\Concerns\CreatesIdempotently;
use App\Http\Controllers\Controller;
use App\Http\Requests\DiaperChanges\StoreDiaperChangeRequest;
use App\Http\Requests\DiaperChanges\UpdateDiaperChangeRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DiaperChangeController extends Controller
{
    use CreatesIdempotently;

    public function index(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        // `since` opcional: los avisos del Dashboard solo necesitan los
        // últimos días, no el historial entero (Estadísticas sí lo pide
        // completo, sin `since`).
        $validated = $request->validate([
            'since' => ['nullable', 'date'],
            'compact' => ['nullable', 'boolean'],
        ]);
        $since = $validated['since'] ?? null;

        $query = $baby->diaperChanges()->orderByDesc('changed_at');
        if ($since !== null) {
            $query->where('changed_at', '>=', $since);
        }

        // `compact`: solo lo que usan los avisos del Dashboard (id, hora y
        // tipo), sin hidratar un modelo por fila. Con ~140 pañales eran ~18 ms
        // y 20 KB; en producción (una fracción de CPU) se notaba. Las horas
        // salen con el mismo formato que las del modelo ("...000000Z").
        if ($request->boolean('compact')) {
            return response()->json(['data' => $query->toBase()->get(['id', 'baby_id', 'changed_at', 'type'])->map(fn ($row) => [
                'id' => (int) $row->id,
                'baby_id' => (int) $row->baby_id,
                'changed_at' => gmdate('Y-m-d\TH:i:s.000000\Z', (int) strtotime((string) $row->changed_at)),
                'type' => $row->type,
            ])->all()]);
        }

        return response()->json(['data' => $query->get()]);
    }

    // StoreDiaperChangeRequest/UpdateDiaperChangeRequest authorize
    // themselves (via AuthorizesBabyAccess) - before rules() runs, not
    // after, unlike an explicit $this->authorize() here would be (see
    // that trait's own docblock for why the difference matters for this
    // baby's data).
    public function store(StoreDiaperChangeRequest $request, Baby $baby): JsonResponse
    {
        return $this->createOnce($baby->diaperChanges(), [
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);
    }

    public function update(UpdateDiaperChangeRequest $request, Baby $baby, int $diaperChange): JsonResponse
    {
        $diaperChangeModel = $baby->diaperChanges()->findOrFail($diaperChange);
        $diaperChangeModel->update($request->validated());

        return response()->json(['data' => $diaperChangeModel]);
    }

    public function destroy(Baby $baby, int $diaperChange): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->diaperChanges()->findOrFail($diaperChange)->delete();

        return response()->json(status: 204);
    }
}
