<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Only meaningful for a breastfeed (FeedType::Pecho) - null for a bottle
 * or solid feed, same "one column, prohibited_unless" pattern already
 * used for `side`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feeds', function (Blueprint $table) {
            $table->string('milk_type')->nullable()->after('side');
        });
    }

    public function down(): void
    {
        Schema::table('feeds', function (Blueprint $table) {
            $table->dropColumn('milk_type');
        });
    }
};
