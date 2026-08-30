<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('growth_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('measured_at');
            // Grams (not kg) to avoid float rounding on a value parents
            // often care about precisely; height/head stay in cm with one
            // decimal, matching how a scale/tape actually reports them.
            $table->unsignedInteger('weight_grams')->nullable();
            $table->decimal('height_cm', 5, 1)->nullable();
            $table->decimal('head_circumference_cm', 5, 1)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['baby_id', 'measured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('growth_measurements');
    }
};
