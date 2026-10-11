<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Preselecciona dónde se toma la temperatura en "+ Temperatura" al crear
 * (no al editar, que siempre muestra el de la propia medición) - mismo
 * criterio que default_diaper_size. Sin valor por defecto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('default_temperature_method')->nullable()->after('default_feed_duration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('default_temperature_method');
        });
    }
};
