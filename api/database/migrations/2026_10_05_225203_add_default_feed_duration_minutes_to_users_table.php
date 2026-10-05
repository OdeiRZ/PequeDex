<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Preselecciona los minutos en el selector de duración de "+ Toma"
 * (solo visible para pecho) al crear - sin valor por defecto, igual
 * que dejarlo en "Sin indicar" hoy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('default_feed_duration_minutes')
                ->nullable()
                ->after('default_diaper_size');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('default_feed_duration_minutes');
        });
    }
};
