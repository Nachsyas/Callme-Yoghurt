<?php

declare(strict_types=1);

namespace App\Domain\Storage\Services;

use App\Domain\Storage\Models\StoredObject;
use DateTimeInterface;

class RetentionPolicyService
{
    /**
     * Determine whether a stored object is currently eligible for deletion.
     *
     * Invariants:
     * - An object under legal hold is NEVER eligible for deletion regardless of delete_after.
     * - An object with a null delete_after timestamp is retained indefinitely.
     * - An object is eligible only when delete_after is non-null, has expired, and legal_hold is false.
     */
    public function isDeletionEligible(StoredObject $object, DateTimeInterface $now): bool
    {
        if ($object->legal_hold) {
            return false;
        }

        if ($object->delete_after === null) {
            return false;
        }

        return $now >= $object->delete_after;
    }
}
