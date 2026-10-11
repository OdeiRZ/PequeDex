<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vaccinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            // Quién la marcó como puesta o la añadió - trazabilidad, igual
            // que en el resto de registros. Null en las filas generadas
            // desde la plantilla que nadie ha tocado todavía.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Clave estable de la plantilla (p.ej. "hexa_2m"); null en las
            // vacunas añadidas a mano.
            $table->string('code')->nullable();
            $table->string('name');
            // Texto de la edad tal cual lo dice el calendario ("2 meses",
            // "3-4 años") - la fecha prevista sola no lo transmite.
            $table->string('age_label')->nullable();
            $table->date('due_date')->nullable();
            $table->date('given_at')->nullable();
            // Solo en determinados casos (hepatitis B al nacer, VRS, gripe):
            // no cuenta como "pendiente".
            $table->boolean('optional')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['baby_id', 'due_date']);
        });

        Schema::create('checkups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->dateTime('scheduled_at');
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['baby_id', 'scheduled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkups');
        Schema::dropIfExists('vaccinations');
    }
};
