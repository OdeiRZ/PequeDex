<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores the avatar as a full data: URI (base64), not a disk path -
 * Render wipes the local filesystem on every redeploy unless you pay for
 * a persistent disk (the reason milestone photos go to R2 instead), but
 * a tiny profile picture is small enough that a DB column sidesteps the
 * whole problem instead. AvatarProcessor keeps it small (resized to fit
 * 320x320) before it ever reaches this column. Same pattern as MIRA
 * MarketLens's users.logo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('avatar')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar');
        });
    }
};
