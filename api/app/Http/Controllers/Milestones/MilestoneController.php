<?php

namespace App\Http\Controllers\Milestones;

use App\Http\Controllers\Controller;
use App\Http\Requests\Milestones\StoreMilestoneRequest;
use App\Http\Requests\Milestones\UpdateMilestoneRequest;
use App\Models\Baby;
use App\Models\Milestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class MilestoneController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        return response()->json(['data' => $baby->milestones()->orderByDesc('achieved_at')->get()]);
    }

    public function store(StoreMilestoneRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $milestone = $baby->milestones()->create([
            'achieved_at' => $request->validated('achieved_at'),
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
            'user_id' => $request->user()->id,
            'photo_path' => $request->hasFile('photo')
                ? $request->file('photo')->store("milestones/{$baby->id}", 'public')
                : null,
        ]);

        return response()->json(['data' => $milestone], 201);
    }

    public function update(UpdateMilestoneRequest $request, Baby $baby, int $milestone): JsonResponse
    {
        $this->authorize('update', $baby);

        $milestoneModel = $baby->milestones()->findOrFail($milestone);

        $attributes = [
            'achieved_at' => $request->validated('achieved_at'),
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
        ];

        if ($request->hasFile('photo')) {
            $this->deleteExistingPhoto($milestoneModel);
            $attributes['photo_path'] = $request->file('photo')->store("milestones/{$baby->id}", 'public');
        } elseif ($request->boolean('remove_photo')) {
            $this->deleteExistingPhoto($milestoneModel);
            $attributes['photo_path'] = null;
        }

        $milestoneModel->update($attributes);

        return response()->json(['data' => $milestoneModel]);
    }

    public function destroy(Baby $baby, int $milestone): JsonResponse
    {
        $this->authorize('update', $baby);

        $milestoneModel = $baby->milestones()->findOrFail($milestone);
        $this->deleteExistingPhoto($milestoneModel);
        $milestoneModel->delete();

        return response()->json(status: 204);
    }

    private function deleteExistingPhoto(Milestone $milestone): void
    {
        if ($milestone->photo_path) {
            Storage::disk('public')->delete($milestone->photo_path);
        }
    }
}
