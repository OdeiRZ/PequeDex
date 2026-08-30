<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Babies\BabyController;
use App\Http\Controllers\Babies\TimelineController;
use App\Http\Controllers\DiaperChanges\DiaperChangeController;
use App\Http\Controllers\Feeds\FeedController;
use App\Http\Controllers\Sleeps\SleepController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', fn (Request $request) => $request->user());

    Route::get('/babies', [BabyController::class, 'index']);
    Route::post('/babies', [BabyController::class, 'store']);
    Route::post('/babies/join', [BabyController::class, 'join']);
    Route::get('/babies/{baby}', [BabyController::class, 'show']);
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

    Route::get('/babies/{baby}/diaper-changes', [DiaperChangeController::class, 'index']);
    Route::post('/babies/{baby}/diaper-changes', [DiaperChangeController::class, 'store']);
    Route::put('/babies/{baby}/diaper-changes/{diaperChange}', [DiaperChangeController::class, 'update']);
    Route::delete('/babies/{baby}/diaper-changes/{diaperChange}', [DiaperChangeController::class, 'destroy']);
});
