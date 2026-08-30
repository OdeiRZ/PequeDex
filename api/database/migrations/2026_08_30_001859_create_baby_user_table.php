<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which caregivers can see/log data for a baby - a pure pivot (no id),
 * same shape as MIRA MarketLens's own familia_user. Unlike that one
 * (admin grants access wholesale via sync()), rows here are added one at
 * a time as each caregiver joins via BabyController::join() - so
 * timestamps are kept (via the model's withTimestamps()) to know when
 * each caregiver actually joined, useful data here rather than the
 * cosmetic-only "joined" wholesale case familia_user has.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('baby_user', function (Blueprint $table) {
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['baby_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baby_user');
    }
};
