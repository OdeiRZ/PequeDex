<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Panel de temperatura del Dashboard (TemperatureCard.vue): con
            // true sale al registrar una temperatura y se queda 48 h, como
            // siempre; con false no sale. Activado por defecto para no
            // cambiar nada a quien ya lo usa.
            $table->boolean('temperature_panel_enabled')->default(true)->after('alerts_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('temperature_panel_enabled');
        });
    }
};
