<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vaccinations', function (Blueprint $table) {
            // Vacuna de plantilla cambiada a mano (nombre, fecha prevista
            // o notas): al cambiar de comunidad se conserva en vez de
            // rehacerse desde la plantilla nueva.
            $table->boolean('edited')->default(false)->after('notes');
            // Fecha prevista puesta a mano: no se recalcula al cambiar la
            // fecha de nacimiento del bebé.
            $table->boolean('due_date_edited')->default(false)->after('edited');
        });
    }

    public function down(): void
    {
        Schema::table('vaccinations', function (Blueprint $table) {
            $table->dropColumn(['edited', 'due_date_edited']);
        });
    }
};
