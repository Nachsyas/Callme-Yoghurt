<?php

declare(strict_types=1);

namespace App\Domain\Storage\Models;

use App\Domain\Storage\Enums\DataClassification;
use App\Domain\Storage\Enums\RetentionClass;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;
use RuntimeException;

class StoredObject extends Model
{
    use HasUuids;

    protected $table = 'stored_objects';

    protected $fillable = [
        'storage_disk',
        'object_key',
        'bucket',
        'original_filename',
        'media_type',
        'byte_size',
        'sha256',
        'classification',
        'retention_class',
        'delete_after',
        'legal_hold',
    ];

    /**
     * Attributes cast to native types.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'byte_size' => 'integer',
            'classification' => DataClassification::class,
            'retention_class' => RetentionClass::class,
            'delete_after' => 'datetime',
            'legal_hold' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (StoredObject $object) {
            if ($object->byte_size < 0) {
                throw new InvalidArgumentException("byte_size cannot be negative: {$object->byte_size}");
            }

            if ($object->sha256 !== null) {
                $canonical = strtolower(trim((string) $object->sha256));
                if (!preg_match('/^[a-f0-9]{64}$/', $canonical)) {
                    throw new InvalidArgumentException("Invalid SHA-256 hash format: {$object->sha256}");
                }
                $object->sha256 = $canonical;
            }
        });

        static::deleting(function (StoredObject $object) {
            if ($object->legal_hold) {
                throw new RuntimeException('StoredObject deletion prohibited: object is under legal hold.');
            }

            if ($object->delete_after === null) {
                throw new RuntimeException('StoredObject deletion prohibited: delete_after is not set.');
            }

            if (now()->lessThan($object->delete_after)) {
                throw new RuntimeException('StoredObject deletion prohibited: delete_after has not expired.');
            }
        });
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(ObjectAttachment::class, 'stored_object_id');
    }
}
