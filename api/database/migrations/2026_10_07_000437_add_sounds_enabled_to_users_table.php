<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Activado por defecto, como el resto de ajustes de esta familia.
            $table->boolean('sounds_enabled')->default(true)->after('default_feed_duration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('sounds_enabled');
        });
    }
};
