<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('baby_vitamin_d_doses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->boolean('given');
            $table->timestamps();

            // One dose per calendar day - marking/correcting a day is an
            // upsert on this pair, never a second row for the same date.
            $table->unique(['baby_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baby_vitamin_d_doses');
    }
};
