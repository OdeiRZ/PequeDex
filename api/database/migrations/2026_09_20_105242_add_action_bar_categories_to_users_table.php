<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // null = todas las categorias visibles (comportamiento actual,
            // sin migrar filas existentes); un array explicito solo cuando
            // el usuario ha personalizado la barra.
            $table->json('action_bar_categories')->nullable()->after('avatar');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('action_bar_categories');
        });
    }
};
