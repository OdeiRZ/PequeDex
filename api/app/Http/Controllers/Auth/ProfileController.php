<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateAvatarRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\User;
use App\Services\Users\AvatarProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
        ]);

        return response()->json($user);
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update(['password' => Hash::make($request->validated('password'))]);

        return response()->json(status: 204);
    }

    public function updateAvatar(UpdateAvatarRequest $request, AvatarProcessor $processor): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update(['avatar' => $processor->process($request->file('avatar'))]);

        return response()->json($user);
    }

    // No file to clean up on disk - the avatar only ever lives in this
    // one column, so removing it is just nulling the field out.
    public function deleteAvatar(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update(['avatar' => null]);

        return response()->json(status: 204);
    }
}
