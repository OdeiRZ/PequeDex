<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Preselecciona la talla en "+ Pañal" al crear (no al editar, que
 * siempre muestra la talla ya guardada de la propia entrada) - sin
 * valor por defecto, igual que el propio campo en diaper_changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('default_diaper_size')->nullable()->after('interaction_feedback_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('default_diaper_size');
        });
    }
};
