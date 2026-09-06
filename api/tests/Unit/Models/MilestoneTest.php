<?php

use App\Models\Milestone;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Support\Facades\Storage;

it('signs the photo url with a short expiry on a disk that supports temporary urls', function () {
    // The "public" disk used elsewhere in tests doesn't support temporary
    // URLs at all, so this exercises the branch that only ever runs
    // against the real S3/R2 disk in production - see Milestone::photoUrl()'s
    // own docblock for why (hallazgo de una auditoría de seguridad).
    $disk = Mockery::mock(Cloud::class);
    $disk->shouldReceive('providesTemporaryUrls')->andReturn(true);
    $disk->shouldReceive('temporaryUrl')
        ->once()
        ->with('milestones/1/photo.jpg', Mockery::on(fn ($expiration) => $expiration->isFuture()))
        ->andReturn('https://signed.example.com/milestones/1/photo.jpg?signature=abc');

    Storage::shouldReceive('disk')->with('s3')->andReturn($disk);
    config(['filesystems.milestones_disk' => 's3']);

    $milestone = new Milestone(['photo_path' => 'milestones/1/photo.jpg']);

    expect($milestone->photo_url)->toBe('https://signed.example.com/milestones/1/photo.jpg?signature=abc');
});

it('falls back to a plain url on a disk that does not support temporary urls', function () {
    Storage::fake('public');
    config(['filesystems.milestones_disk' => 'public']);

    $milestone = new Milestone(['photo_path' => 'milestones/1/photo.jpg']);

    expect($milestone->photo_url)->toContain('milestones/1/photo.jpg')
        ->and($milestone->photo_url)->not->toContain('signature=');
});

it('returns null without touching the disk when there is no photo', function () {
    $milestone = new Milestone(['photo_path' => null]);

    expect($milestone->photo_url)->toBeNull();
});
