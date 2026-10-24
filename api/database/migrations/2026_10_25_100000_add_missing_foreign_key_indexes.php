<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL no crea índice para una clave foránea (MySQL sí), y estas columnas
 * no encabezaban ningún índice. La que se usa a diario es baby_user.user_id (los
 * bebés de un usuario, en cada petición: la clave primaria de la tabla empieza por
 * baby_id). El resto es el autor de cada registro: sin índice, borrar una cuenta
 * recorría las doce tablas enteras para poner su user_id a null.
 */
return new class extends Migration
{
    private const TABLAS = [
        'baby_user',
        'feeds',
        'sleeps',
        'diaper_changes',
        'growth_measurements',
        'milestones',
        'milestone_likes',
        'contractions',
        'baby_vitamin_d_schedules',
        'baby_vitamin_d_doses',
        'temperatures',
        'vaccinations',
        'checkups',
    ];

    public function up(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, fn (Blueprint $table) => $table->index('user_id'));
        }
    }

    public function down(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, fn (Blueprint $table) => $table->dropIndex(['user_id']));
        }
    }
};
