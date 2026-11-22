<?php

declare(strict_types=1);

namespace App\Domain\Storage\Contracts;

use DateTimeInterface;

interface ObjectStorageProviderInterface
{
    /**
     * Store binary contents at the specified storage key with optional metadata.
     *
     * @param array<string, mixed> $metadata
     */
    public function put(string $key, string $contents, array $metadata = []): bool;

    /**
     * Check whether an object exists at the specified key.
     */
    public function exists(string $key): bool;

    /**
     * Delete an object from the underlying storage disk by key.
     */
    public function delete(string $key): bool;

    /**
     * Generate a temporary signed read URL for the specified key.
     */
    public function temporaryUrl(string $key, DateTimeInterface $expiresAt): string;

    /**
     * Retrieve metadata/headers for the specified key.
     *
     * @return array<string, mixed>
     */
    public function metadata(string $key): array;
}
