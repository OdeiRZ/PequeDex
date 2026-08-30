<?php

use App\Models\Baby;
use App\Models\Milestone;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function babyForMilestoneTest(User $user): Baby
{
    $baby = Baby::factory()->create();
    $baby->users()->attach($user);

    return $baby;
}

beforeEach(function () {
    Storage::fake('public');
});

it('creates a milestone without a photo', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Primera sonrisa',
    ])->assertCreated()
        ->assertJsonPath('data.title', 'Primera sonrisa')
        ->assertJsonPath('data.photo_url', null);
});

it('rejects an achieved_at before the baby was born', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => '2026-08-30']);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-29',
        'title' => 'Imposible',
    ])->assertUnprocessable()->assertJsonValidationErrors('achieved_at');
});

it('accepts an achieved_at right on the birth date, e.g. a "born" milestone', function () {
    $user = actingAsUser();
    $baby = Baby::factory()->create(['birth_date' => '2026-08-30']);
    $baby->users()->attach($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Nacimiento',
    ])->assertCreated();
});

it('creates a milestone with a photo, stored on the public disk', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $response = $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Primera sonrisa',
        'photo' => UploadedFile::fake()->image('sonrisa.jpg'),
    ]);

    $response->assertCreated();
    $path = Milestone::findOrFail($response->json('data.id'))->photo_path;
    Storage::disk('public')->assertExists($path);
    expect($response->json('data.photo_url'))->toContain($path);
});

it('creates a milestone with a category', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Primeros pasos',
        'category' => 'pasos',
    ])->assertCreated()->assertJsonPath('data.category', 'pasos');
});

it('rejects an invalid category', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Primeros pasos',
        'category' => 'no-existe',
    ])->assertUnprocessable()->assertJsonValidationErrors('category');
});

it('allows a milestone with no category at all', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Algo especial',
    ])->assertCreated()->assertJsonPath('data.category', null);
});

it('rejects a non-image file as the photo', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);

    $this->postJson("/api/babies/{$baby->id}/milestones", [
        'achieved_at' => '2026-08-30',
        'title' => 'Primera sonrisa',
        'photo' => UploadedFile::fake()->create('documento.pdf', 100),
    ])->assertUnprocessable()->assertJsonValidationErrors('photo');
});

it('replaces the photo on update, deleting the old file', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);
    $oldPath = UploadedFile::fake()->image('old.jpg')->store("milestones/{$baby->id}", 'public');
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create(['photo_path' => $oldPath]);

    $response = $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}", [
        'achieved_at' => '2026-08-30',
        'title' => 'Actualizado',
        'photo' => UploadedFile::fake()->image('new.jpg'),
    ]);

    $response->assertOk();
    Storage::disk('public')->assertMissing($oldPath);
    Storage::disk('public')->assertExists($milestone->refresh()->photo_path);
});

it('removes the photo when remove_photo is sent', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);
    $oldPath = UploadedFile::fake()->image('old.jpg')->store("milestones/{$baby->id}", 'public');
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create(['photo_path' => $oldPath]);

    $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}", [
        'achieved_at' => '2026-08-30',
        'title' => 'Actualizado',
        'remove_photo' => true,
    ])->assertOk()->assertJsonPath('data.photo_path', null);

    Storage::disk('public')->assertMissing($oldPath);
});

it('deletes a milestone and its photo file', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);
    $path = UploadedFile::fake()->image('photo.jpg')->store("milestones/{$baby->id}", 'public');
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create(['photo_path' => $path]);

    $this->deleteJson("/api/babies/{$baby->id}/milestones/{$milestone->id}")->assertNoContent();

    $this->assertDatabaseMissing('milestones', ['id' => $milestone->id]);
    Storage::disk('public')->assertMissing($path);
});

it('lets a caregiver see a milestone logged by the other caregiver', function () {
    $owner = actingAsUser();
    $baby = babyForMilestoneTest($owner);
    $milestone = Milestone::factory()->for($baby)->for($owner, 'loggedBy')->create();

    $partner = User::factory()->create();
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');

    $this->getJson("/api/babies/{$baby->id}/milestones")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $milestone->id);
});

it('rejects any access to milestones for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForMilestoneTest($other);

    $this->getJson("/api/babies/{$baby->id}/milestones")->assertForbidden();
});

it('toggles a like on and off for the current user', function () {
    $user = actingAsUser();
    $baby = babyForMilestoneTest($user);
    $milestone = Milestone::factory()->for($baby)->for($user, 'loggedBy')->create();

    $liked = $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}/like");
    $liked->assertOk()->assertJsonPath('data.liked_by.0.id', $user->id);
    expect($milestone->likedBy()->count())->toBe(1);

    $unliked = $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}/like");
    $unliked->assertOk()->assertJsonCount(0, 'data.liked_by');
    expect($milestone->likedBy()->count())->toBe(0);
});

it('lets a caregiver see the other caregiver\'s like', function () {
    $owner = actingAsUser();
    $baby = babyForMilestoneTest($owner);
    $milestone = Milestone::factory()->for($baby)->for($owner, 'loggedBy')->create();

    $partner = User::factory()->create(['name' => 'Partner']);
    $baby->users()->attach($partner);
    $this->actingAs($partner, 'sanctum');
    $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}/like")->assertOk();

    $this->actingAs($owner, 'sanctum');
    $this->getJson("/api/babies/{$baby->id}/milestones")
        ->assertOk()
        ->assertJsonPath('data.0.liked_by.0.name', 'Partner');
});

it('rejects liking a milestone for a baby the user is not linked to', function () {
    actingAsUser();
    $other = User::factory()->create();
    $baby = babyForMilestoneTest($other);
    $milestone = Milestone::factory()->for($baby)->for($other, 'loggedBy')->create();

    $this->postJson("/api/babies/{$baby->id}/milestones/{$milestone->id}/like")->assertForbidden();
});
