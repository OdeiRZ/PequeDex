<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Desactivado por defecto - la papelera siempre visible sigue
            // siendo el comportamiento conocido; activar el swipe es una
            // elección explícita desde Perfil, no algo que cambie de golpe
            // bajo los pies de quien ya usa la app.
            $table->boolean('swipe_to_delete_enabled')->default(false)->after('predictions_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('swipe_to_delete_enabled');
        });
    }
};
