<?php

namespace App\Models;

use App\Enums\MilestoneCategory;
use Database\Factories\MilestoneFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Storage;

class Milestone extends Model
{
    /** @use HasFactory<MilestoneFactory> */
    use HasFactory;

    protected $fillable = ['baby_id', 'user_id', 'achieved_at', 'title', 'category', 'description', 'photo_path'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'achieved_at' => 'date:Y-m-d',
            'category' => MilestoneCategory::class,
        ];
    }

    protected $appends = ['photo_url'];

    /**
     * How long a signed photo URL stays valid once handed to the frontend -
     * long enough to load the image and sit in the timeline/story viewer for
     * a normal session, short enough that a URL that leaks (browser history,
     * a shared screenshot's page source) stops working well before anyone
     * finds it.
     */
    private const PHOTO_URL_TTL_MINUTES = 30;

    /**
     * Appended to every array/JSON representation (see $appends above) - the
     * frontend only ever needs a servable URL, never the raw disk path.
     * Signed with a short expiry on the S3/R2 disk (production) - hallazgo
     * de una auditoría de seguridad: R2 no tiene ACL por objeto como S3, así
     * que un bucket con acceso público sirve *todos* sus objetos sin más
     * control que lo impredecible del nombre de archivo, y estas son fotos
     * de bebés. Requiere que el bucket esté configurado en privado en
     * Cloudflare para que esto cierre el hueco de verdad - una URL firmada
     * sobre un bucket todavía público no protege nada, ya que el propio
     * objeto sigue siendo alcanzable sin la firma.
     * The local "public" disk used in development doesn't support signed
     * URLs at all (no server-side signing for plain disk files), so it
     * falls back to its own permanent url() there - fine locally, since
     * nothing on a dev machine is actually exposed to the internet.
     */
    protected function photoUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->photo_path) {
                    return null;
                }

                $disk = Storage::disk(config('filesystems.milestones_disk'));

                return $disk->providesTemporaryUrls()
                    ? $disk->temporaryUrl($this->photo_path, now()->addMinutes(self::PHOTO_URL_TTL_MINUTES))
                    : $disk->url($this->photo_path);
            },
        );
    }

    /**
     * @return BelongsTo<Baby, $this>
     */
    public function baby(): BelongsTo
    {
        return $this->belongsTo(Baby::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function loggedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Caregivers who reacted to this milestone - a single toggleable
     * like per person, not a set of emoji to pick from (see
     * milestone_likes' own migration). Whether *the current* user is
     * among them is left for the frontend to check against auth.user.id
     * rather than a model-level accessor, since a model has no notion of
     * "who's asking".
     *
     * @return BelongsToMany<User, $this>
     */
    public function likedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'milestone_likes')->withTimestamps();
    }
}
