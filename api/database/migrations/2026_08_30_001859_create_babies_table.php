<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('babies', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            // Both nullable on purpose: the app can be used before birth
            // (due_date set, birth_date null) - the actual day just fills
            // in birth_date without losing the due_date history.
            $table->date('due_date')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('invite_code')->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('babies');
    }
};
