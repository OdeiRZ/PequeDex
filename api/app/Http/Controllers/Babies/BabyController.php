<?php

namespace App\Http\Controllers\Babies;

use App\Http\Controllers\Controller;
use App\Http\Requests\Babies\JoinBabyRequest;
use App\Http\Requests\Babies\StoreBabyRequest;
use App\Models\Baby;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BabyController extends Controller
{
    /** The authenticated user's own babies - almost always exactly one. */
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->babies]);
    }

    public function store(StoreBabyRequest $request): JsonResponse
    {
        $baby = Baby::create([
            'name' => $request->validated('name'),
            'due_date' => $request->validated('due_date'),
            'invite_code' => Baby::generateInviteCode(),
        ]);

        $baby->users()->attach($request->user());

        return response()->json(['data' => $baby], 201);
    }

    /** Links the authenticated user to the baby the code belongs to. */
    public function join(JoinBabyRequest $request): JsonResponse
    {
        $baby = Baby::where('invite_code', $request->validated('invite_code'))->firstOrFail();

        // idempotent: joining a baby you're already on just confirms it,
        // rather than a 500 on the pivot's own unique constraint.
        if (! $baby->users->contains($request->user())) {
            $baby->users()->attach($request->user());
            // $baby->users was already lazy-loaded (and cached) by the
            // ->contains() check above, from *before* the attach() just
            // above - without this refresh, the response below would
            // serialize that stale pre-attach list, silently missing the
            // caregiver who just joined (found live: the DB write was
            // correct, only this response's own JSON was stale).
            $baby->load('users');
        }

        return response()->json(['data' => $baby]);
    }

    public function show(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby]);
    }

    /** Any linked caregiver can rotate the code - e.g. if it leaked. */
    public function regenerateInviteCode(Request $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->update(['invite_code' => Baby::generateInviteCode()]);

        return response()->json(['data' => $baby]);
    }
}
