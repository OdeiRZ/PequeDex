<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los registros de un bebé (tomas, sueños, pañales...) llevaban `user_id` con
 * `cascadeOnDelete`: borrar a un cuidador habría borrado también todo lo que
 * había anotado en un bebé compartido, y con él se perdería la mitad del
 * historial del otro cuidador. Ahora, al borrar la cuenta de alguien, sus
 * registros se quedan y solo pierden el autor (`user_id` pasa a `null`).
 * `vaccinations` ya funcionaba así.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TABLES = [
        'feeds',
        'sleeps',
        'diaper_changes',
        'growth_measurements',
        'milestones',
        'contractions',
        'temperatures',
        'checkups',
        'baby_vitamin_d_schedules',
        'baby_vitamin_d_doses',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, fn (Blueprint $table) => $table->dropForeign(['user_id']));
            Schema::table($tableName, fn (Blueprint $table) => $table->unsignedBigInteger('user_id')->nullable()->change());
            Schema::table($tableName, fn (Blueprint $table) => $table->foreign('user_id')->references('id')->on('users')->nullOnDelete());
        }
    }

    /**
     * Vuelve a exigir autor. Falla si ya hay registros sin autor (de cuentas
     * borradas): esos datos no se pueden atribuir a nadie y no se inventan.
     */
    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, fn (Blueprint $table) => $table->dropForeign(['user_id']));
            Schema::table($tableName, fn (Blueprint $table) => $table->unsignedBigInteger('user_id')->nullable(false)->change());
            Schema::table($tableName, fn (Blueprint $table) => $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete());
        }
    }
};
