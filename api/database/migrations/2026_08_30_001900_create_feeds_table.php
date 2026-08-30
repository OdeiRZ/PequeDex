<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feeds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('baby_id')->constrained()->cascadeOnDelete();
            // Who logged it, for trazability only - never used to scope
            // visibility, both caregivers see every feed for the baby
            // regardless of who logged it (see BabyPolicy).
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            // Only set for FeedType::Pecho - see StoreFeedRequest.
            $table->string('side')->nullable();
            // Only set for FeedType::Biberon.
            $table->unsignedInteger('amount_ml')->nullable();
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Real query pattern: list/order a baby's own feeds by date.
            $table->index(['baby_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feeds');
    }
};
