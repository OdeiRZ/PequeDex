<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contractions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->dateTime('started_at');
            // Null while the contraction is still being timed (see Sleep,
            // same convention: no separate "is_ongoing" flag needed).
            $table->dateTime('ended_at')->nullable();
            // 0 = leve, 1 = moderada, 2 = intensa - set on creation
            // (default 0) and refined afterwards from the edit sheet.
            $table->unsignedTinyInteger('intensity')->default(0);
            $table->timestamps();

            $table->index(['baby_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contractions');
    }
};
