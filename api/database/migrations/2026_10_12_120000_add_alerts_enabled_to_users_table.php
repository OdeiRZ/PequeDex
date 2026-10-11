<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Avisos suaves del Dashboard ("Lleva 3 días sin caca"...).
            // Activado por defecto, como el resto de ajustes de esta familia.
            $table->boolean('alerts_enabled')->default(true)->after('stats_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('alerts_enabled');
        });
    }
};
