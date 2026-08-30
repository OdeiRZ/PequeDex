<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A single toggleable reaction per caregiver per milestone - not a set of
 * emoji to choose from, just "I saw this and it mattered to me". Same
 * pure-pivot shape as baby_user (no id, composite primary key), so a
 * caregiver can only like a given milestone once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestone_likes', function (Blueprint $table) {
            $table->foreignId('milestone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['milestone_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('milestone_likes');
    }
};
