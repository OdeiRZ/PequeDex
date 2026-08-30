<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nullable on purpose: needed to pick the right WHO growth-standard table
 * (weight/height/head-circumference-for-age are published separately per
 * sex), but a baby created before it's known - or a family choosing not
 * to say - can still use every other feature. Growth percentiles simply
 * aren't computed until this is set (see WhoGrowthStandards).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->string('sex')->nullable()->after('birth_date');
        });
    }

    public function down(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->dropColumn('sex');
        });
    }
};
