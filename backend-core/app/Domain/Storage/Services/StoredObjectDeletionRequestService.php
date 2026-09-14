<?php

declare(strict_types=1);

namespace App\Domain\Storage\Services;

use App\Domain\Storage\Models\StoredObject;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StoredObjectDeletionRequestService
{
    public function __construct(
        private readonly RetentionPolicyService $retentionPolicy,
    ) {
    }

    /**
     * Safely request deletion of a stored object using transactional row locking.
     *
     * Flow:
     * 1. Opens a database transaction.
     * 2. Locks the stored_objects row FOR UPDATE to eliminate TOCTOU race conditions.
     * 3. Re-evaluates retention policy eligibility against the freshly locked record.
     * 4. Rejects if legal_hold is true, delete_after is null, or delete_after has not expired.
     * 5. Sets deletion_requested_at to record durable deletion intent.
     * 6. Commits the transaction without executing any physical binary deletion.
     *
     * @throws RuntimeException if the object is ineligible under retention rules or legal hold.
     */
    public function requestDeletion(StoredObject $object, ?DateTimeInterface $now = null): StoredObject
    {
        $currentTime = $now ?? now();

        return DB::transaction(function () use ($object, $currentTime) {
            /** @var StoredObject $lockedObject */
            $lockedObject = StoredObject::where('id', $object->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (!$this->retentionPolicy->isDeletionEligible($lockedObject, $currentTime)) {
                if ($lockedObject->legal_hold) {
                    throw new RuntimeException(
                        "Cannot request deletion for StoredObject [{$lockedObject->id}]: object is under legal hold."
                    );
                }

                if ($lockedObject->delete_after === null) {
                    throw new RuntimeException(
                        "Cannot request deletion for StoredObject [{$lockedObject->id}]: delete_after is not scheduled."
                    );
                }

                throw new RuntimeException(
                    "Cannot request deletion for StoredObject [{$lockedObject->id}]: retention period has not expired."
                );
            }

            // Idempotent: record deletion request timestamp if not already set
            if ($lockedObject->deletion_requested_at === null) {
                $lockedObject->deletion_requested_at = $currentTime;
                $lockedObject->save();
            }

            return $lockedObject;
        });
    }
}
