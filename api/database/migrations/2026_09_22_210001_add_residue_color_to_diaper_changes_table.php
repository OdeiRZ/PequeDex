<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Only meaningful when there's something to look at - null for a purely
 * wet change (DiaperType::Mojado), optional even for a dirty one (not
 * every caregiver wants to note it every time).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('diaper_changes', function (Blueprint $table) {
            $table->string('residue_color')->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('diaper_changes', function (Blueprint $table) {
            $table->dropColumn('residue_color');
        });
    }
};
