<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('temperatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->dateTime('measured_at');
            // Grados Celsius con un decimal (36.8) - lo que da cualquier
            // termómetro doméstico.
            $table->decimal('celsius', 3, 1);
            $table->string('method')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['baby_id', 'measured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temperatures');
    }
};
