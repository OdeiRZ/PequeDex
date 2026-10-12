<?php

use App\Services\Users\AvatarProcessor;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Moves users.avatar to its own table (see App\Models\UserAvatar for why)
 * and shrinks the existing avatars (320px PNG, ~80 KB) to the current
 * 128px WebP while copying them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_avatars', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->text('data');
            $table->timestamps();
        });

        $processor = new AvatarProcessor;
        $now = now();

        DB::table('users')->whereNotNull('avatar')->orderBy('id')->each(function ($user) use ($processor, $now) {
            DB::table('user_avatars')->insert([
                'user_id' => $user->id,
                'data' => $processor->shrinkDataUri($user->avatar) ?? $user->avatar,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('avatar')->nullable()->after('email');
        });

        DB::table('user_avatars')->orderBy('user_id')->each(function ($row) {
            DB::table('users')->where('id', $row->user_id)->update(['avatar' => $row->data]);
        });

        Schema::dropIfExists('user_avatars');
    }
};
