<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opcional, igual que residue_color - no todo el mundo quiere anotar la
 * talla cada vez que cambia un pañal, y no está ligada al tipo (aplica
 * igual a mojado/sucio/ambos).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('diaper_changes', function (Blueprint $table) {
            $table->string('size')->nullable()->after('residue_color');
        });
    }

    public function down(): void
    {
        Schema::table('diaper_changes', function (Blueprint $table) {
            $table->dropColumn('size');
        });
    }
};
