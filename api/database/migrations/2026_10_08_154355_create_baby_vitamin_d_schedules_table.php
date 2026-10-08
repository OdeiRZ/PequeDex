<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('baby_vitamin_d_schedules', function (Blueprint $table) {
            $table->id();
            // unique(): one row per baby, reused across activate/deactivate
            // cycles - not a history, just the currently configured pauta.
            $table->foreignId('baby_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baby_vitamin_d_schedules');
    }
};
