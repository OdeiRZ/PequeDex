<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When the caregiver's waters broke - lives on Baby, not its own table,
 * same reasoning as due_date: a fact about the current pregnancy, not a
 * repeated event. Unlike birth_date/due_date this needs the time, not
 * just the day (see ContractionsView.vue), so it's a plain datetime
 * cast, not date:Y-m-d.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->dateTime('water_broke_at')->nullable()->after('birth_date');
        });
    }

    public function down(): void
    {
        Schema::table('babies', function (Blueprint $table) {
            $table->dropColumn('water_broke_at');
        });
    }
};
