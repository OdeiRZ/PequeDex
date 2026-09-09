<?php

namespace App\Http\Controllers\Milestones;

use App\Http\Controllers\Controller;
use App\Http\Requests\Milestones\StoreMilestoneRequest;
use App\Http\Requests\Milestones\UpdateMilestoneRequest;
use App\Models\Baby;
use App\Models\Milestone;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MilestoneController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json([
            'data' => $baby->milestones()->with('likedBy')->orderByDesc('achieved_at')->get(),
        ]);
    }

    // StoreMilestoneRequest/UpdateMilestoneRequest authorize themselves
    // (via AuthorizesBabyAccess) - before rules() runs, not after,
    // unlike an explicit $this->authorize() here would be (see that
    // trait's own docblock for why the difference matters for this
    // baby's data).
    public function store(StoreMilestoneRequest $request, Baby $baby): JsonResponse
    {
        $milestone = $baby->milestones()->create([
            'achieved_at' => $request->validated('achieved_at'),
            'title' => $request->validated('title'),
            'category' => $request->validated('category'),
            'description' => $request->validated('description'),
            'user_id' => $request->user()->id,
            'photo_path' => $request->hasFile('photo')
                ? $request->file('photo')->store("milestones/{$baby->id}", config('filesystems.milestones_disk'))
                : null,
        ]);

        return response()->json(['data' => $milestone->load('likedBy')], 201);
    }

    public function update(UpdateMilestoneRequest $request, Baby $baby, int $milestone): JsonResponse
    {
        $milestoneModel = $baby->milestones()->findOrFail($milestone);

        $attributes = [
            'achieved_at' => $request->validated('achieved_at'),
            'title' => $request->validated('title'),
            'category' => $request->validated('category'),
            'description' => $request->validated('description'),
        ];

        if ($request->hasFile('photo')) {
            $this->deleteExistingPhoto($milestoneModel);
            $attributes['photo_path'] = $request->file('photo')->store("milestones/{$baby->id}", config('filesystems.milestones_disk'));
        } elseif ($request->boolean('remove_photo')) {
            $this->deleteExistingPhoto($milestoneModel);
            $attributes['photo_path'] = null;
        }

        $milestoneModel->update($attributes);

        return response()->json(['data' => $milestoneModel->load('likedBy')]);
    }

    public function destroy(Baby $baby, int $milestone): JsonResponse
    {
        $this->authorize('update', $baby);

        $milestoneModel = $baby->milestones()->findOrFail($milestone);
        $this->deleteExistingPhoto($milestoneModel);
        $milestoneModel->delete();

        return response()->json(status: 204);
    }

    // A single toggle, not separate like/unlike routes - the caller
    // doesn't need to know its own current state first, it just flips it.
    public function toggleLike(Request $request, Baby $baby, int $milestone): JsonResponse
    {
        $this->authorize('view', $baby);

        $milestoneModel = $baby->milestones()->findOrFail($milestone);
        $user = $request->user();

        if ($milestoneModel->likedBy()->where('user_id', $user->id)->exists()) {
            $milestoneModel->likedBy()->detach($user->id);
        } else {
            try {
                $milestoneModel->likedBy()->attach($user->id);
            } catch (QueryException $e) {
                // A concurrent double-tap can race past the exists()
                // check above and the pivot's own unique constraint
                // before either request commits (hallazgo de una
                // auditoría de código) - the end state either request
                // actually wanted (liked) is already true either way, so
                // only that specific violation (SQLSTATE class "23") is
                // swallowed instead of surfacing as a 500; any other
                // failure still bubbles up.
                if (! str_starts_with($e->getCode(), '23')) {
                    throw $e;
                }
            }
        }

        return response()->json(['data' => $milestoneModel->load('likedBy')]);
    }

    private function deleteExistingPhoto(Milestone $milestone): void
    {
        if ($milestone->photo_path) {
            Storage::disk(config('filesystems.milestones_disk'))->delete($milestone->photo_path);
        }
    }
}
