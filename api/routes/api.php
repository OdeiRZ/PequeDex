<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Babies\BabyController;
use App\Http\Controllers\Babies\TimelineController;
use App\Http\Controllers\DiaperChanges\DiaperChangeController;
use App\Http\Controllers\Feeds\FeedController;
use App\Http\Controllers\GrowthMeasurements\GrowthMeasurementController;
use App\Http\Controllers\Milestones\MilestoneController;
use App\Http\Controllers\Sleeps\SleepController;
use App\Http\Controllers\Sleeps\SleepPredictionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', fn (Request $request) => $request->user());
    Route::put('/user', [ProfileController::class, 'update']);
    Route::put('/user/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:6,1');
    Route::post('/user/avatar', [ProfileController::class, 'updateAvatar'])->middleware('throttle:6,1');
    Route::delete('/user/avatar', [ProfileController::class, 'deleteAvatar']);

    Route::get('/babies', [BabyController::class, 'index']);
    Route::post('/babies', [BabyController::class, 'store']);
    // Throttled like the other secret-guessing surfaces (login, password) -
    // the invite code's keyspace (32^8) makes brute-forcing impractical on
    // its own, but this was the one such endpoint with no rate limit at all.
    Route::post('/babies/join', [BabyController::class, 'join'])->middleware('throttle:10,1');
    Route::get('/babies/{baby}', [BabyController::class, 'show']);
    Route::put('/babies/{baby}', [BabyController::class, 'update']);
    Route::post('/babies/{baby}/invite-code', [BabyController::class, 'regenerateInviteCode']);
    Route::get('/babies/{baby}/timeline', [TimelineController::class, 'index']);

    Route::get('/babies/{baby}/feeds', [FeedController::class, 'index']);
    Route::post('/babies/{baby}/feeds', [FeedController::class, 'store']);
    Route::put('/babies/{baby}/feeds/{feed}', [FeedController::class, 'update']);
    Route::delete('/babies/{baby}/feeds/{feed}', [FeedController::class, 'destroy']);

    Route::get('/babies/{baby}/sleeps', [SleepController::class, 'index']);
    Route::post('/babies/{baby}/sleeps', [SleepController::class, 'store']);
    Route::put('/babies/{baby}/sleeps/{sleep}', [SleepController::class, 'update']);
    Route::delete('/babies/{baby}/sleeps/{sleep}', [SleepController::class, 'destroy']);
    Route::get('/babies/{baby}/sleep-prediction', [SleepPredictionController::class, 'show']);

    Route::get('/babies/{baby}/diaper-changes', [DiaperChangeController::class, 'index']);
    Route::post('/babies/{baby}/diaper-changes', [DiaperChangeController::class, 'store']);
    Route::put('/babies/{baby}/diaper-changes/{diaperChange}', [DiaperChangeController::class, 'update']);
    Route::delete('/babies/{baby}/diaper-changes/{diaperChange}', [DiaperChangeController::class, 'destroy']);

    Route::get('/babies/{baby}/growth-measurements', [GrowthMeasurementController::class, 'index']);
    Route::post('/babies/{baby}/growth-measurements', [GrowthMeasurementController::class, 'store']);
    Route::put('/babies/{baby}/growth-measurements/{growthMeasurement}', [GrowthMeasurementController::class, 'update']);
    Route::delete('/babies/{baby}/growth-measurements/{growthMeasurement}', [GrowthMeasurementController::class, 'destroy']);

    Route::get('/babies/{baby}/milestones', [MilestoneController::class, 'index']);
    Route::post('/babies/{baby}/milestones', [MilestoneController::class, 'store']);
    // POST, not PUT: a multipart request carrying a replacement photo file
    // needs Laravel's method-spoofing (_method=PUT in the form body) to
    // reach a PUT route at all - PHP itself never parses a PUT request's
    // multipart body into $_FILES, only POST's. Simpler to just route the
    // edit as POST directly than to rely on every client remembering to
    // spoof it.
    Route::post('/babies/{baby}/milestones/{milestone}', [MilestoneController::class, 'update']);
    Route::delete('/babies/{baby}/milestones/{milestone}', [MilestoneController::class, 'destroy']);
    Route::post('/babies/{baby}/milestones/{milestone}/like', [MilestoneController::class, 'toggleLike']);
});
