<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Activado por defecto - las tarjetas resumen ya eran visibles
            // para todo el mundo antes de que existiera este ajuste.
            $table->boolean('today_summary_enabled')->default(true)->after('swipe_to_delete_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('today_summary_enabled');
        });
    }
};
