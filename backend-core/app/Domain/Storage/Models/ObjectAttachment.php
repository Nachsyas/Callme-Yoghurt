<?php

declare(strict_types=1);

namespace App\Domain\Storage\Models;

use App\Domain\Storage\Enums\AttachmentOwnerType;
use App\Domain\Storage\Enums\AttachmentPurpose;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class ObjectAttachment extends Model
{
    use HasUuids;

    protected $table = 'object_attachments';

    protected $fillable = [
        'stored_object_id',
        'owner_type',
        'owner_id',
        'purpose',
    ];

    /**
     * Attributes cast to native types.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'purpose' => AttachmentPurpose::class,
            'owner_type' => AttachmentOwnerType::class,
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ObjectAttachment $attachment) {
            // Validate owner_type
            $ownerType = $attachment->owner_type;
            $ownerEnum = $ownerType instanceof AttachmentOwnerType
                ? $ownerType
                : AttachmentOwnerType::tryFrom((string) $ownerType);

            if ($ownerEnum === null) {
                throw new InvalidArgumentException("Unsupported attachment owner type: {$ownerType}");
            }

            // Validate purpose
            $purpose = $attachment->purpose;
            $purposeEnum = $purpose instanceof AttachmentPurpose
                ? $purpose
                : AttachmentPurpose::tryFrom((string) $purpose);

            if ($purposeEnum === null) {
                throw new InvalidArgumentException("Unsupported attachment purpose: {$purpose}");
            }

            // Verify owner exists in authoritative storage
            $modelClass = $ownerEnum->modelClass();
            if (!$modelClass::where('id', $attachment->owner_id)->exists()) {
                throw new InvalidArgumentException("Nonexistent owner [{$ownerEnum->value}] with ID: {$attachment->owner_id}");
            }
        });
    }

    public function storedObject(): BelongsTo
    {
        return $this->belongsTo(StoredObject::class, 'stored_object_id');
    }

    /**
     * Resolve the owning Eloquent model instance.
     */
    public function resolveOwner(): ?Model
    {
        $ownerEnum = $this->owner_type instanceof AttachmentOwnerType
            ? $this->owner_type
            : AttachmentOwnerType::tryFrom((string) $this->owner_type);

        if ($ownerEnum === null) {
            return null;
        }

        $modelClass = $ownerEnum->modelClass();
        return $modelClass::find($this->owner_id);
    }
}
