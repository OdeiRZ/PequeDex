<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Por bebé, no por usuario: la comunidad autónoma decide qué calendario
 * de vacunas se le aplica (ver App\Services\Vaccinations), y "Vacunas y
 * revisiones" se activa para un bebé concreto, igual que la pauta de
 * vitamina D.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->string('region')->nullable()->after('sex');
            $table->boolean('vaccinations_enabled')->default(false)->after('region');
        });
    }

    public function down(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->dropColumn(['region', 'vaccinations_enabled']);
        });
    }
};
