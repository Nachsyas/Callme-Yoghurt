<?php

declare(strict_types=1);

namespace App\Domain\Storage\Services;

use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use DateTimeInterface;
use Illuminate\Contracts\Filesystem\Factory as FilesystemFactory;
use Illuminate\Contracts\Filesystem\Filesystem;
use RuntimeException;

/**
 * Production-ready S3-compatible Object Storage Provider.
 *
 * Invariants (Phase 1.1):
 * - Backed by Laravel Filesystem abstraction (league/flysystem-aws-s3-v3).
 * - Compatible with AWS S3, Cloudflare R2, and MinIO.
 * - Stores binary data exclusively in remote object storage; PostgreSQL stores metadata only.
 * - In production: FAILS CLOSED if required credentials/bucket are missing.
 * - Never logs or leaks raw storage credentials.
 * - Generates temporary signed URLs only; never exposes permanent public URLs.
 */
class S3ObjectStorageProvider implements ObjectStorageProviderInterface
{
    /**
     * @param array<string, mixed>|null $credentials Optional override credentials for testing/scenarios.
     */
    public function __construct(
        private readonly FilesystemFactory $filesystem,
        private readonly string $diskName = "object",
        private readonly bool $isProduction = false,
        private readonly ?array $credentials = null,
    ) {
    }

    /**
     * Store binary contents at the specified storage key with optional metadata.
     *
     * @param array<string, mixed> $metadata
     */
    public function put(string $key, string $contents, array $metadata = []): bool
    {
        $this->ensureConfigured();

        return $this->getDisk()->put($key, $contents, $metadata);
    }

    /**
     * Check whether an object exists at the specified key.
     */
    public function exists(string $key): bool
    {
        $this->ensureConfigured();

        return $this->getDisk()->exists($key);
    }

    /**
     * Delete an object from the underlying storage disk by key.
     */
    public function delete(string $key): bool
    {
        $this->ensureConfigured();

        return $this->getDisk()->delete($key);
    }

    /**
     * Generate a temporary signed read URL for the specified key.
     */
    public function temporaryUrl(string $key, DateTimeInterface $expiresAt): string
    {
        $this->ensureConfigured();

        $disk = $this->getDisk();

        if (!method_exists($disk, "temporaryUrl")) {
            throw new RuntimeException("Underlying disk [{$this->diskName}] does not support temporary URLs.");
        }

        return $disk->temporaryUrl($key, $expiresAt);
    }

    /**
     * Retrieve metadata/headers for the specified key.
     *
     * @return array<string, mixed>
     */
    public function metadata(string $key): array
    {
        $this->ensureConfigured();

        $disk = $this->getDisk();

        return [
            "size" => $disk->size($key),
            "mime_type" => $disk->mimeType($key),
            "last_modified" => $disk->lastModified($key),
        ];
    }

    /**
     * Resolve the underlying filesystem disk.
     */
    private function getDisk(): Filesystem
    {
        return $this->filesystem->disk($this->diskName);
    }

    /**
     * Enforce strict fail-closed security invariants in production.
     *
     * @throws RuntimeException if production storage credentials or bucket are missing.
     */
    private function ensureConfigured(): void
    {
        if (!$this->isProduction) {
            return;
        }

        $key = $this->credentials["key"] ?? config("filesystems.disks.{$this->diskName}.key");
        $secret = $this->credentials["secret"] ?? config("filesystems.disks.{$this->diskName}.secret");
        $bucket = $this->credentials["bucket"] ?? config("filesystems.disks.{$this->diskName}.bucket");

        if (empty($key) || empty($secret) || empty($bucket)) {
            throw new RuntimeException(
                "Production object storage is unavailable: OBJECT_STORAGE_ACCESS_KEY, OBJECT_STORAGE_SECRET_KEY, and OBJECT_STORAGE_BUCKET are required (FAIL CLOSED)."
            );
        }
    }
}
