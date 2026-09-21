<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Activadas por defecto - útil desde el primer momento, sin
            // que el usuario tenga que ir a buscar dónde encenderlas.
            $table->boolean('predictions_enabled')->default(true)->after('action_bar_categories');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('predictions_enabled');
        });
    }
};
