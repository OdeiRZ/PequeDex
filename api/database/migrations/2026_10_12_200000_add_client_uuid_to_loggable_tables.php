<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registro sin conexión: el móvil genera un identificador para cada
 * toma/sueño/pañal/temperatura que crea. Si el envío se corta a medias y
 * se reintenta, el servidor reconoce el identificador y devuelve el
 * registro que ya existe en vez de crear uno duplicado (ver
 * App\Http\Controllers\Concerns\CreatesIdempotently). Nullable: los
 * registros de siempre, y cualquier cliente que no lo mande, siguen
 * funcionando igual.
 */
return new class extends Migration
{
    private const TABLES = ['feeds', 'sleeps', 'diaper_changes', 'temperatures'];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->uuid('client_uuid')->nullable()->unique();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) use ($name) {
                $table->dropUnique("{$name}_client_uuid_unique");
                $table->dropColumn('client_uuid');
            });
        }
    }
};
