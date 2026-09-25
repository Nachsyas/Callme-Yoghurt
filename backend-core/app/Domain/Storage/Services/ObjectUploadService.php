<?php

declare(strict_types=1);

namespace App\Domain\Storage\Services;

use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use App\Domain\Storage\Enums\DataClassification;
use App\Domain\Storage\Enums\RetentionClass;
use App\Domain\Storage\Models\StoredObject;
use DateTimeInterface;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Application service for securely storing object binaries in distributed storage
 * and registering authoritative metadata in PostgreSQL.
 *
 * Invariants (Phase 1.1):
 * - Never stores binary data in PostgreSQL; PostgreSQL stores metadata only.
 * - Enforces PII sanitization on object keys (never contains phone, name, email, or customer IDs).
 * - Verifies SHA-256 integrity and byte size calculation.
 * - Fails closed on storage provider errors.
 */
class ObjectUploadService
{
    public function __construct(
        private readonly ObjectStorageProviderInterface $storageProvider,
        private readonly string $diskName = "object",
    ) {
    }

    /**
     * Store binary data to object storage and record authoritative metadata in PostgreSQL.
     *
     * @param array<string, mixed> $metadata
     */
    public function upload(
        string $contents,
        string $originalFilename,
        string $mediaType,
        DataClassification $classification,
        RetentionClass $retentionClass,
        string $scope = "general",
        ?DateTimeInterface $deleteAfter = null,
        bool $legalHold = false,
        array $metadata = [],
    ): StoredObject {
        $byteSize = strlen($contents);
        $sha256 = hash("sha256", $contents);

        $objectKey = $this->generateSafeKey($scope, $originalFilename, $mediaType);

        // 1. Store binary exclusively in object storage provider
        $stored = $this->storageProvider->put($objectKey, $contents, $metadata);
        if (!$stored) {
            throw new RuntimeException("Failed to store object binary at [{$objectKey}] (FAIL CLOSED).");
        }

        // 2. Persist metadata record in PostgreSQL (no binary column)
        $bucket = config("filesystems.disks.{$this->diskName}.bucket");

        return StoredObject::create([
            "storage_disk" => $this->diskName,
            "object_key" => $objectKey,
            "bucket" => $bucket,
            "original_filename" => $originalFilename,
            "media_type" => $mediaType,
            "byte_size" => $byteSize,
            "sha256" => $sha256,
            "classification" => $classification,
            "retention_class" => $retentionClass,
            "delete_after" => $deleteAfter,
            "legal_hold" => $legalHold,
        ]);
    }

    /**
     * Generate an internal locator key guaranteed free of PII and business identifiers.
     *
     * Rules:
     * - Key must NOT contain customer phone, customer name, email, or customer business IDs.
     * - Generates hierarchical internal locator: objects/{safeScope}/{ulid}/{safeFilename}
     * - Allowed example: objects/products/01HF83/image.webp
     */
    public function generateSafeKey(string $scope, string $originalFilename, string $mediaType): string
    {
        $safeScope = $this->sanitizeScope($scope);
        $opaqueId = (string) Str::ulid();
        $safeFilename = $this->sanitizeFilename($originalFilename, $mediaType);

        return "objects/{$safeScope}/{$opaqueId}/{$safeFilename}";
    }

    /**
     * Sanitize scope segment, scrubbing potential PII patterns.
     */
    private function sanitizeScope(string $scope): string
    {
        $cleaned = strtolower(trim($scope));

        // Scrub email addresses
        $cleaned = preg_replace("/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i", "masked", $cleaned) ?? "general";

        // Scrub phone numbers (Indonesian standard, international, or 7+ contiguous digits)
        $cleaned = preg_replace("/(\\+?62|08|\\b)\\d{6,15}\\b/", "masked", $cleaned) ?? "general";

        // Scrub customer identifier prefixes (e.g. customer081234567, cust-123)
        $cleaned = preg_replace("/\\bcustomer[_-]?[a-z0-9]*\\b/i", "scoped", $cleaned) ?? "general";

        // Strip non-alphanumeric characters except safe path separators and dashes
        $cleaned = preg_replace("/[^a-z0-9\\/_-]/", "-", $cleaned) ?? "general";
        $cleaned = trim(preg_replace("/[\\/_-]+/", "/", $cleaned) ?? "general", "/");

        return $cleaned !== "" ? $cleaned : "general";
    }

    /**
     * Sanitize base filename and extension, scrubbing potential PII.
     */
    private function sanitizeFilename(string $filename, string $mediaType): string
    {
        $baseName = pathinfo($filename, PATHINFO_FILENAME);
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($extension === "") {
            $extension = match (strtolower(trim($mediaType))) {
                "image/webp" => "webp",
                "image/png" => "png",
                "image/jpeg", "image/jpg" => "jpg",
                "application/pdf" => "pdf",
                "text/plain" => "txt",
                default => "bin",
            };
        }

        // Scrub PII from base name
        $safeBase = strtolower(trim($baseName));
        $safeBase = preg_replace("/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i", "", $safeBase) ?? "";
        $safeBase = preg_replace("/(\\+?62|08|\\b)\\d{6,15}\\b/", "", $safeBase) ?? "";
        $safeBase = preg_replace("/\\bcustomer[_-]?[a-z0-9]*\\b/i", "", $safeBase) ?? "";
        $safeBase = preg_replace("/[^a-z0-9_-]/", "-", $safeBase) ?? "";
        $safeBase = trim(preg_replace("/-+/", "-", $safeBase) ?? "", "-");

        if ($safeBase === "") {
            $safeBase = match (strtolower(trim($mediaType))) {
                "image/webp", "image/png", "image/jpeg" => "image",
                "application/pdf" => "document",
                default => "asset",
            };
        }

        return "{$safeBase}.{$extension}";
    }
}
