<?php

declare(strict_types=1);

namespace App\Domain\Storage\Services;

use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use App\Domain\Storage\Models\StoredObject;
use DateTimeInterface;
use RuntimeException;

class StoredObjectDeletionService
{
    public function __construct(
        private readonly RetentionPolicyService $retentionPolicy,
        private readonly ?ObjectStorageProviderInterface $storageProvider = null,
    ) {
    }

    /**
     * Safely delete a stored object if retention policy conditions are satisfied.
     *
     * Flow:
     * 1. Evaluates eligibility via RetentionPolicyService.
     * 2. Deletes physical binary via ObjectStorageProviderInterface if provider is bound.
     * 3. Deletes database metadata record (protected by model hook and database trigger).
     *
     * @throws RuntimeException if object is under legal hold or retention period has not expired.
     */
    public function delete(StoredObject $object, ?DateTimeInterface $now = null): bool
    {
        $currentTime = $now ?? now();

        if (!$this->retentionPolicy->isDeletionEligible($object, $currentTime)) {
            throw new RuntimeException(
                "Cannot delete StoredObject [{$object->id}]: ineligible under current retention policy or legal hold."
            );
        }

        // Delete underlying binary blob if provider is available
        if ($this->storageProvider !== null && $this->storageProvider->exists($object->object_key)) {
            $this->storageProvider->delete($object->object_key);
        }

        // Delete metadata record (triggers model deleting hook and DB trigger)
        return (bool) $object->delete();
    }
}
