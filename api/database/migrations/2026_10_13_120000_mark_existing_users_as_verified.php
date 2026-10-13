<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Las cuentas que ya existen se dan por confirmadas: se crearon cuando no había
 * verificación de email, y así, el día que se active `REQUIRE_EMAIL_VERIFICATION`,
 * no se queda fuera ninguna cuenta antigua. Solo las nuevas deberán confirmar.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);
    }

    /** No se puede saber cuáles estaban sin confirmar antes: no se deshace. */
    public function down(): void
    {
        //
    }
};
