<?php

namespace App\Http\Controllers\Babies;

use App\Http\Controllers\Controller;
use App\Http\Requests\Babies\JoinBabyRequest;
use App\Http\Requests\Babies\StoreBabyRequest;
use App\Http\Requests\Babies\UpdateBabyRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BabyController extends Controller
{
    /** The authenticated user's own babies - almost always exactly one. */
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->babies]);
    }

    /**
     * Wrapped in a transaction (hallazgo de una auditoría de código): sin
     * ella, un fallo entre el create() y el attach() dejaba un Baby huérfano
     * sin ningún cuidador vinculado - inaccesible para siempre, sin nada que
     * lo limpiara.
     */
    public function store(StoreBabyRequest $request): JsonResponse
    {
        $baby = DB::transaction(function () use ($request) {
            $baby = Baby::create([
                'name' => $request->validated('name'),
                'due_date' => $request->validated('due_date'),
                'birth_date' => $request->validated('birth_date'),
                'sex' => $request->validated('sex'),
                'invite_code' => Baby::generateInviteCode(),
            ]);

            $baby->users()->attach($request->user());

            return $baby;
        });

        return response()->json(['data' => $baby], 201);
    }

    /** Any linked caregiver can edit - e.g. filling in birth_date/sex once known. */
    public function update(UpdateBabyRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->update($request->validated());

        return response()->json(['data' => $baby]);
    }

    /** Links the authenticated user to the baby the code belongs to. */
    public function join(JoinBabyRequest $request): JsonResponse
    {
        $baby = Baby::where('invite_code', $request->validated('invite_code'))->firstOrFail();

        // idempotent: joining a baby you're already on just confirms it,
        // rather than a 500 on the pivot's own unique constraint.
        if (! $baby->users->contains($request->user())) {
            $baby->users()->attach($request->user());
        }

        // ->users was lazy-loaded (and cached) by the ->contains() check
        // above - left as-is it would serialize below, leaking every
        // caregiver's full profile (email, avatar) in the response for no
        // reason (hallazgo de una auditoría de código): no other Baby
        // endpoint includes it, and the frontend's Baby type doesn't
        // declare the field either.
        $baby->unsetRelation('users');

        return response()->json(['data' => $baby]);
    }

    public function show(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby]);
    }

    /**
     * Unlinks the authenticated user from the baby - the reverse of join().
     * Blocked as the last remaining caregiver: leaving would strand the
     * baby with zero caregivers, making it permanently inaccessible (same
     * failure mode store()'s own transaction guards against on the way
     * in) - there's no baby-deletion feature to fall back to, so leaving
     * needs someone else linked first.
     */
    public function leave(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return DB::transaction(function () use ($request, $baby) {
            // lockForUpdate() (hallazgo de una auditoría de código, mismo
            // patrón que el de store() arriba): sin ella, el count() de
            // abajo y el detach() son un check-then-act sin nada que los
            // haga atómicos entre procesos - con exactamente 2 cuidadores,
            // dos abandonos casi simultáneos podían ver ambos count()==2
            // antes de que cualquiera hiciera detach(), dejando el bebé
            // sin ningún cuidador. El lock serializa la segunda petición
            // hasta que la primera termina, así que ve ya el count()==1
            // real y se rechaza correctamente.
            Baby::whereKey($baby->id)->lockForUpdate()->firstOrFail();

            if ($baby->users()->count() <= 1) {
                return response()->json([
                    'message' => 'Eres el único cuidador de este bebé. Invita a alguien más antes de abandonarlo.',
                ], 422);
            }

            $baby->users()->detach($request->user());

            return response()->json(status: 204);
        });
    }

    /** Any linked caregiver can rotate the code - e.g. if it leaked. */
    public function regenerateInviteCode(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->update(['invite_code' => Baby::generateInviteCode()]);

        return response()->json(['data' => $baby]);
    }
}
