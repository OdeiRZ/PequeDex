<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('achieved_at');
            $table->string('title');
            $table->text('description')->nullable();
            // Path on the 'public' disk, not a URL - a milestone photo is
            // the baby's own, with no external source to link to instead
            // (unlike e.g. LudoDex's BGG-sourced game covers), so a real
            // upload is the only option here. Nullable: a milestone is
            // still worth recording without a photo.
            $table->string('photo_path')->nullable();
            $table->timestamps();

            $table->index(['baby_id', 'achieved_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('milestones');
    }
};
