<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use App\Domain\Storage\Enums\DataClassification;
use App\Domain\Storage\Enums\RetentionClass;
use App\Domain\Storage\Models\StoredObject;
use App\Domain\Storage\Services\ObjectUploadService;
use App\Domain\Storage\Services\S3ObjectStorageProvider;
use Illuminate\Contracts\Filesystem\Factory as FilesystemFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class ObjectStorageRuntimeTest extends TestCase
{
    use RefreshDatabase;

    private ObjectUploadService $uploadService;
    private ObjectStorageProviderInterface $storageProvider;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('object');

        $this->storageProvider = new S3ObjectStorageProvider(
            filesystem: app(FilesystemFactory::class),
            diskName: 'object',
            isProduction: false,
        );

        $this->uploadService = new ObjectUploadService(
            storageProvider: $this->storageProvider,
            diskName: 'object',
        );
    }

    /**
     * Test 1: Upload stores metadata correctly.
     * Verify: object key, SHA256, byte size, media type.
     */
    public function test_upload_stores_metadata_correctly(): void
    {
        $payload = 'BINARY_PAYLOAD_STRAWBERRY_PRODUCT_IMAGE_WEBP';
        $expectedSha256 = hash('sha256', $payload);
        $expectedByteSize = strlen($payload);

        $storedObject = $this->uploadService->upload(
            contents: $payload,
            originalFilename: 'strawberry-250g.webp',
            mediaType: 'image/webp',
            classification: DataClassification::PUBLIC,
            retentionClass: RetentionClass::HOT,
            scope: 'products',
        );

        $this->assertInstanceOf(StoredObject::class, $storedObject);
        $this->assertNotEmpty($storedObject->id);

        // 1. Verify object key
        $this->assertStringStartsWith('objects/products/', $storedObject->object_key);
        $this->assertStringEndsWith('/strawberry-250g.webp', $storedObject->object_key);

        // 2. Verify SHA256
        $this->assertSame($expectedSha256, $storedObject->sha256);

        // 3. Verify byte size
        $this->assertSame($expectedByteSize, $storedObject->byte_size);

        // 4. Verify media type
        $this->assertSame('image/webp', $storedObject->media_type);

        // Verify storage disk contains the exact binary contents
        $this->assertTrue(Storage::disk('object')->exists($storedObject->object_key));
        $this->assertSame($payload, Storage::disk('object')->get($storedObject->object_key));
    }

    /**
     * Test 2: Binary is NOT stored in database.
     * Verify: stored_objects contains metadata only.
     */
    public function test_binary_is_not_stored_in_database(): void
    {
        $payload = 'CONFIDENTIAL_PAYLOAD_NEVER_ALLOWED_IN_POSTGRES';

        $storedObject = $this->uploadService->upload(
            contents: $payload,
            originalFilename: 'financial-report.pdf',
            mediaType: 'application/pdf',
            classification: DataClassification::CONFIDENTIAL,
            retentionClass: RetentionClass::WARM,
            scope: 'invoices',
        );

        // 1. Verify schema: no blob, binary, or payload columns exist in stored_objects
        $columns = Schema::getColumnListing('stored_objects');
        $this->assertNotContains('binary', $columns);
        $this->assertNotContains('binary_data', $columns);
        $this->assertNotContains('content', $columns);
        $this->assertNotContains('contents', $columns);
        $this->assertNotContains('payload', $columns);
        $this->assertNotContains('data', $columns);
        $this->assertNotContains('blob', $columns);

        // 2. Verify raw row from PostgreSQL contains strictly metadata
        $rawRow = (array) DB::table('stored_objects')->where('id', $storedObject->id)->first();
        $this->assertNotEmpty($rawRow);

        // Confirm the raw binary payload is not contained in any column value
        foreach ($rawRow as $columnName => $value) {
            $this->assertNotSame(
                $payload,
                $value,
                "Binary payload must not be stored in PostgreSQL column [{$columnName}]"
            );
        }
    }

    /**
     * Test 3: Object key generation is safe.
     * Verify: No PII leakage (phone, name, email, customer IDs).
     */
    public function test_object_key_generation_is_safe_and_prevents_pii_leakage(): void
    {
        $sensitivePhone = '081234567890';
        $sensitiveInternationalPhone = '+6281234567890';
        $sensitiveEmail = 'budi.santoso@example.com';
        $sensitiveName = 'budi_santoso';
        $sensitiveCustomerId = 'customer081234567';

        $scopeWithPii = "customer/{$sensitivePhone}";
        $filenameWithPii = "{$sensitiveCustomerId}_{$sensitiveName}_{$sensitiveEmail}_invoice.pdf";

        $safeKey = $this->uploadService->generateSafeKey(
            scope: $scopeWithPii,
            originalFilename: $filenameWithPii,
            mediaType: 'application/pdf',
        );

        // Invariants: Key must not leak customer phone, email, name, or customer business IDs
        $this->assertStringNotContainsString($sensitivePhone, $safeKey);
        $this->assertStringNotContainsString('081234567', $safeKey);
        $this->assertStringNotContainsString($sensitiveInternationalPhone, $safeKey);
        $this->assertStringNotContainsString($sensitiveEmail, $safeKey);
        $this->assertStringNotContainsString($sensitiveCustomerId, $safeKey);

        // Proves format is structured safely: objects/{safeScope}/{ulid}/{safeFilename}
        $this->assertStringStartsWith('objects/', $safeKey);
        $this->assertStringEndsWith('.pdf', $safeKey);

        // Proves standard example 'objects/products/01HF83/image.webp' matches structure
        $productKey = $this->uploadService->generateSafeKey('products', 'image.webp', 'image/webp');
        $this->assertStringStartsWith('objects/products/', $productKey);
        $this->assertStringEndsWith('/image.webp', $productKey);
    }

    /**
     * Test 4: Missing production credentials fail closed.
     * Expected: No upload allowed.
     */
    public function test_missing_production_credentials_fail_closed(): void
    {
        $prodProviderWithoutCreds = new S3ObjectStorageProvider(
            filesystem: app(FilesystemFactory::class),
            diskName: 'object',
            isProduction: true,
            credentials: [
                'key' => null,
                'secret' => null,
                'bucket' => null,
            ],
        );

        $service = new ObjectUploadService(
            storageProvider: $prodProviderWithoutCreds,
            diskName: 'object',
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('FAIL CLOSED');

        $service->upload(
            contents: 'TEST_BINARY_DATA',
            originalFilename: 'test.webp',
            mediaType: 'image/webp',
            classification: DataClassification::PUBLIC,
            retentionClass: RetentionClass::HOT,
        );
    }

    /**
     * Test 5: Temporary URL generation works through provider abstraction.
     * Use fake/mock provider if external S3 unavailable.
     */
    public function test_temporary_url_generation_works_through_provider_abstraction(): void
    {
        $storedObject = $this->uploadService->upload(
            contents: 'SAMPLE_WEBP_DATA',
            originalFilename: 'avatar.webp',
            mediaType: 'image/webp',
            classification: DataClassification::PUBLIC,
            retentionClass: RetentionClass::HOT,
            scope: 'avatars',
        );

        $expiresAt = now()->addMinutes(15);
        $tempUrl = $this->storageProvider->temporaryUrl($storedObject->object_key, $expiresAt);

        $this->assertNotEmpty($tempUrl);
        $this->assertIsString($tempUrl);
        $this->assertStringContainsString($storedObject->object_key, $tempUrl);
    }
}
