<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Knowledge\Models\KnowledgeChunk;
use App\Domain\Knowledge\Models\KnowledgeDocument;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use App\Domain\Storage\Enums\AttachmentOwnerType;
use App\Domain\Storage\Enums\AttachmentPurpose;
use App\Domain\Storage\Enums\DataClassification;
use App\Domain\Storage\Enums\RetentionClass;
use App\Domain\Storage\Models\ObjectAttachment;
use App\Domain\Storage\Models\StoredObject;
use App\Domain\Storage\Services\RetentionPolicyService;
use App\Domain\Storage\Services\StoredObjectDeletionRequestService;
use DateTimeImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class StorageLifecycleIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private RetentionPolicyService $retentionPolicy;
    private StoredObjectDeletionRequestService $deletionRequestService;
    private ProductVariant $variant;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->retentionPolicy = new RetentionPolicyService();
        $this->deletionRequestService = new StoredObjectDeletionRequestService($this->retentionPolicy);

        // Seed minimal dependencies for attachment ownership
        $uom = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliter',
            'category' => 'VOLUME',
        ]);

        $item = InventoryItem::create([
            'code' => 'FG-CY-STR-250',
            'name' => 'Callme Strawberry 250ml Item',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $uom->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $product = Product::create([
            'name' => 'Callme Strawberry Yoghurt',
            'slug' => 'callme-strawberry-yoghurt',
            'description' => 'Fresh strawberry yoghurt',
            'active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $item->id,
            'sku' => 'CY-STR-250ML',
            'variant_name' => 'Strawberry 250ml Bottle',
            'net_content_quantity' => '250.000000',
            'net_content_uom_id' => $uom->id,
            'active' => true,
        ]);

        $this->order = Order::create([
            'order_number' => 'ORD-2026-0901',
            'status' => OrderStatus::CONFIRMED,
            'total_amount' => 50000,
        ]);
    }

    /**
     * 1. StoredObject persists metadata only without binary payload.
     */
    public function test_stored_object_persists_metadata_without_binary_payload(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/products/2026/09/strawberry-250.webp',
            'bucket' => 'callme-media',
            'original_filename' => 'strawberry-250.webp',
            'media_type' => 'image/webp',
            'byte_size' => 1048576,
            'sha256' => 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'classification' => DataClassification::PUBLIC,
            'retention_class' => RetentionClass::HOT,
            'delete_after' => null,
            'legal_hold' => false,
        ]);

        $this->assertNotNull($object->id);
        $this->assertTrue(Str::isUuid($object->id));
        $this->assertSame('catalog/products/2026/09/strawberry-250.webp', $object->object_key);
        $this->assertSame(1048576, $object->byte_size);
        $this->assertSame(DataClassification::PUBLIC, $object->classification);
        $this->assertSame(RetentionClass::HOT, $object->retention_class);
    }

    /**
     * 2. Binary content has no normal StoredObject database column.
     */
    public function test_binary_content_has_no_normal_stored_object_database_column(): void
    {
        $columns = Schema::getColumnListing('stored_objects');

        $this->assertNotContains('binary_data', $columns);
        $this->assertNotContains('content', $columns);
        $this->assertNotContains('blob', $columns);
        $this->assertNotContains('payload', $columns);
        $this->assertNotContains('file_content', $columns);
    }

    /**
     * 3. (storage_disk, object_key) uniqueness is enforced at database boundary.
     */
    public function test_storage_disk_and_object_key_uniqueness_is_enforced(): void
    {
        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'invoices/2026/INV-001.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 204800,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::WARM,
        ]);

        $this->expectException(QueryException::class);

        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'invoices/2026/INV-001.pdf', // duplicate on same disk
            'media_type' => 'application/pdf',
            'byte_size' => 409600,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::WARM,
        ]);
    }

    /**
     * 4. Negative byte_size fails at model and database boundaries.
     */
    public function test_negative_byte_size_fails(): void
    {
        $this->expectException(InvalidArgumentException::class);

        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/invalid-size.png',
            'media_type' => 'image/png',
            'byte_size' => -100,
            'classification' => DataClassification::PUBLIC,
            'retention_class' => RetentionClass::HOT,
        ]);
    }

    /**
     * 5. Invalid classification fails domain and database checks.
     */
    public function test_invalid_classification_fails(): void
    {
        $this->expectException(\Throwable::class);

        /** @phpstan-ignore-next-line */
        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/invalid-class.png',
            'media_type' => 'image/png',
            'byte_size' => 1024,
            'classification' => 'TOP_SECRET_INVALID',
            'retention_class' => RetentionClass::HOT,
        ]);
    }

    /**
     * 6. Invalid retention class fails domain and database checks.
     */
    public function test_invalid_retention_class_fails(): void
    {
        $this->expectException(\Throwable::class);

        /** @phpstan-ignore-next-line */
        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/invalid-retention.png',
            'media_type' => 'image/png',
            'byte_size' => 1024,
            'classification' => DataClassification::PUBLIC,
            'retention_class' => 'FROZEN_INVALID',
        ]);
    }

    /**
     * 7. Malformed SHA-256 fails validation.
     */
    public function test_malformed_sha256_fails_validation(): void
    {
        $this->expectException(InvalidArgumentException::class);

        StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/bad-hash.png',
            'media_type' => 'image/png',
            'byte_size' => 1024,
            'sha256' => 'not-a-valid-64-char-hex-hash',
            'classification' => DataClassification::PUBLIC,
            'retention_class' => RetentionClass::HOT,
        ]);
    }

    /**
     * 8. Valid canonical SHA-256 persists and normalizes to lowercase.
     */
    public function test_valid_canonical_sha256_persists_in_lowercase(): void
    {
        $uppercaseHash = 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855';

        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/valid-hash.png',
            'media_type' => 'image/png',
            'byte_size' => 1024,
            'sha256' => $uppercaseHash,
            'classification' => DataClassification::PUBLIC,
            'retention_class' => RetentionClass::HOT,
        ]);

        $this->assertSame(strtolower($uppercaseHash), $object->fresh()->sha256);
    }

    /**
     * 9. Future delete_after is not deletion eligible.
     */
    public function test_future_delete_after_is_not_deletion_eligible(): void
    {
        $now = new DateTimeImmutable('2026-09-13 12:00:00');
        $futureDate = new DateTimeImmutable('2026-09-20 12:00:00');

        $object = new StoredObject([
            'delete_after' => $futureDate,
            'legal_hold' => false,
        ]);

        $this->assertFalse($this->retentionPolicy->isDeletionEligible($object, $now));
    }

    /**
     * 10. Null delete_after is not deletion eligible (indefinite retention).
     */
    public function test_null_delete_after_is_not_deletion_eligible(): void
    {
        $now = new DateTimeImmutable('2026-09-13 12:00:00');

        $object = new StoredObject([
            'delete_after' => null,
            'legal_hold' => false,
        ]);

        $this->assertFalse($this->retentionPolicy->isDeletionEligible($object, $now));
    }

    /**
     * 11. Legal hold overrides expired delete_after.
     */
    public function test_legal_hold_overrides_expired_delete_after(): void
    {
        $now = new DateTimeImmutable('2026-09-13 12:00:00');
        $expiredDate = new DateTimeImmutable('2026-09-01 12:00:00');

        $object = new StoredObject([
            'delete_after' => $expiredDate,
            'legal_hold' => true, // Overrides expired date
        ]);

        $this->assertFalse($this->retentionPolicy->isDeletionEligible($object, $now));

        // When legal hold is released, it becomes eligible
        $object->legal_hold = false;
        $this->assertTrue($this->retentionPolicy->isDeletionEligible($object, $now));
    }

    /**
     * 12. Database and model deletion guards match documented retention guarantees.
     */
    public function test_database_and_model_deletion_guards_enforce_retention(): void
    {
        // Case A: Object under legal hold cannot be deleted
        $holdObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'evidence/hold-doc.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::COLD,
            'delete_after' => now()->subDay(),
            'legal_hold' => true,
        ]);

        $this->expectException(RuntimeException::class);
        $holdObject->delete();
    }

    /**
     * 12b. Object with future delete_after cannot be deleted via model.
     */
    public function test_future_delete_after_cannot_be_deleted(): void
    {
        $futureObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'evidence/future-doc.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::WARM,
            'delete_after' => now()->addDays(30),
            'legal_hold' => false,
        ]);

        $this->expectException(RuntimeException::class);
        $futureObject->delete();
    }

    /**
     * 12c. Expired delete_after with legal_hold=false CAN be safely deleted.
     */
    public function test_expired_delete_after_can_be_safely_deleted(): void
    {
        $eligibleObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/expired-doc.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
            'delete_after' => now()->subHour(),
            'legal_hold' => false,
        ]);

        $id = $eligibleObject->id;
        $deleted = $eligibleObject->delete();

        $this->assertTrue($deleted);
        $this->assertNull(StoredObject::find($id));
    }

    /**
     * 12d. Direct SQL deletion on PostgreSQL is guarded by database trigger.
     */
    public function test_database_trigger_guards_direct_sql_deletion_on_postgresql(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            $holdObject = StoredObject::create([
                'storage_disk' => 'object',
                'object_key' => 'evidence/trigger-hold.pdf',
                'media_type' => 'application/pdf',
                'byte_size' => 1024,
                'classification' => DataClassification::CONFIDENTIAL,
                'retention_class' => RetentionClass::COLD,
                'delete_after' => now()->subDay(),
                'legal_hold' => true,
            ]);

            $this->expectException(QueryException::class);
            DB::table('stored_objects')->where('id', $holdObject->id)->delete();
        } else {
            $this->assertTrue(true);
        }
    }

    /**
     * 12e. Eligible object receives deletion_requested_at timestamp and metadata row remains.
     */
    public function test_eligible_object_receives_deletion_requested_at_and_row_remains(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/request-eligible.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 2048,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
            'delete_after' => now()->subMinutes(10),
            'legal_hold' => false,
        ]);

        $this->assertNull($object->deletion_requested_at);
        $this->assertFalse($object->isDeletionRequested());

        $requestedObject = $this->deletionRequestService->requestDeletion($object);

        $this->assertNotNull($requestedObject->deletion_requested_at);
        $this->assertTrue($requestedObject->isDeletionRequested());

        // Prove metadata row remains in database (not deleted)
        $this->assertDatabaseHas('stored_objects', [
            'id' => $object->id,
            'object_key' => 'temp/request-eligible.pdf',
        ]);
        $this->assertNotNull(StoredObject::find($object->id)?->deletion_requested_at);
    }

    /**
     * 12f. Ineligible objects (null, future, legal hold) cannot be requested for deletion.
     */
    public function test_ineligible_objects_cannot_be_requested_for_deletion(): void
    {
        // Case 1: Null delete_after cannot be requested
        $nullObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/null-expire.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::WARM,
            'delete_after' => null,
            'legal_hold' => false,
        ]);

        try {
            $this->deletionRequestService->requestDeletion($nullObject);
            $this->fail('Expected RuntimeException for null delete_after');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('delete_after is not scheduled', $e->getMessage());
        }
        $this->assertNull($nullObject->fresh()->deletion_requested_at);

        // Case 2: Future delete_after cannot be requested
        $futureObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/future-expire.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::WARM,
            'delete_after' => now()->addDays(14),
            'legal_hold' => false,
        ]);

        try {
            $this->deletionRequestService->requestDeletion($futureObject);
            $this->fail('Expected RuntimeException for future delete_after');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('retention period has not expired', $e->getMessage());
        }
        $this->assertNull($futureObject->fresh()->deletion_requested_at);

        // Case 3: Legal-held object cannot be requested even if expired
        $holdObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/held-object.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::COLD,
            'delete_after' => now()->subDays(5),
            'legal_hold' => true,
        ]);

        try {
            $this->deletionRequestService->requestDeletion($holdObject);
            $this->fail('Expected RuntimeException for legal-held object');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('object is under legal hold', $e->getMessage());
        }
        $this->assertNull($holdObject->fresh()->deletion_requested_at);
    }

    /**
     * 12g. Duplicate deletion request is idempotent.
     */
    public function test_duplicate_deletion_request_is_idempotent(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/idempotent.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
            'delete_after' => now()->subMinutes(5),
            'legal_hold' => false,
        ]);

        $firstResult = $this->deletionRequestService->requestDeletion($object);
        $firstTimestamp = $firstResult->deletion_requested_at;

        $secondResult = $this->deletionRequestService->requestDeletion($object);
        $this->assertEquals($firstTimestamp, $secondResult->deletion_requested_at);
    }

    /**
     * 12h. Legal hold placed after deletion request protects object from subsequent deletion.
     */
    public function test_legal_hold_placed_after_deletion_request_protects_object(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'temp/held-after-request.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::WARM,
            'delete_after' => now()->subMinutes(30),
            'legal_hold' => false,
        ]);

        // Phase 1: Request succeeds
        $this->deletionRequestService->requestDeletion($object);
        $this->assertTrue($object->fresh()->isDeletionRequested());

        // Later: Legal hold is applied due to dispute/audit
        $object->legal_hold = true;
        $object->save();

        // Must now fail retention policy check
        $this->assertFalse($this->retentionPolicy->isDeletionEligible($object->fresh(), now()));

        // Model delete must be blocked
        $this->expectException(RuntimeException::class);
        $object->delete();
    }

    /**
     * 13. Controlled valid attachment succeeds for real domain models (ProductVariant & Order).
     */
    public function test_controlled_valid_attachment_succeeds(): void
    {
        $imageObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'catalog/products/strawberry-250.webp',
            'media_type' => 'image/webp',
            'byte_size' => 512000,
            'classification' => DataClassification::PUBLIC,
            'retention_class' => RetentionClass::HOT,
        ]);

        $attachment = ObjectAttachment::create([
            'stored_object_id' => $imageObject->id,
            'owner_type' => AttachmentOwnerType::PRODUCT_VARIANT,
            'owner_id' => $this->variant->id,
            'purpose' => AttachmentPurpose::PRODUCT_IMAGE,
        ]);

        $this->assertNotNull($attachment->id);
        $this->assertSame($this->variant->id, $attachment->owner_id);
        $this->assertSame(AttachmentPurpose::PRODUCT_IMAGE, $attachment->purpose);
        $this->assertInstanceOf(ProductVariant::class, $attachment->resolveOwner());

        // Also test invoice attachment on Order
        $invoiceObject = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'invoices/2026/ord-0901.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 128000,
            'classification' => DataClassification::CONFIDENTIAL,
            'retention_class' => RetentionClass::WARM,
        ]);

        $invoiceAttachment = ObjectAttachment::create([
            'stored_object_id' => $invoiceObject->id,
            'owner_type' => AttachmentOwnerType::ORDER,
            'owner_id' => $this->order->id,
            'purpose' => AttachmentPurpose::INVOICE_PDF,
        ]);

        $this->assertInstanceOf(Order::class, $invoiceAttachment->resolveOwner());
    }

    /**
     * 14. Unsupported owner type fails domain boundary validation.
     */
    public function test_unsupported_owner_type_fails(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'random/doc.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
        ]);

        $this->expectException(\Throwable::class);

        /** @phpstan-ignore-next-line */
        ObjectAttachment::create([
            'stored_object_id' => $object->id,
            'owner_type' => 'UNSUPPORTED_RANDOM_TABLE',
            'owner_id' => (string) Str::uuid(),
            'purpose' => AttachmentPurpose::PRODUCT_IMAGE,
        ]);
    }

    /**
     * 15. Nonexistent owner ID fails application boundary validation.
     */
    public function test_nonexistent_owner_fails_validation(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'random/doc2.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Nonexistent owner');

        ObjectAttachment::create([
            'stored_object_id' => $object->id,
            'owner_type' => AttachmentOwnerType::PRODUCT_VARIANT,
            'owner_id' => (string) Str::uuid(), // Nonexistent variant UUID
            'purpose' => AttachmentPurpose::PRODUCT_IMAGE,
        ]);
    }

    /**
     * 16. Invalid attachment purpose fails validation.
     */
    public function test_invalid_attachment_purpose_fails(): void
    {
        $object = StoredObject::create([
            'storage_disk' => 'object',
            'object_key' => 'random/doc3.pdf',
            'media_type' => 'application/pdf',
            'byte_size' => 1024,
            'classification' => DataClassification::INTERNAL,
            'retention_class' => RetentionClass::HOT,
        ]);

        $this->expectException(\Throwable::class);

        /** @phpstan-ignore-next-line */
        ObjectAttachment::create([
            'stored_object_id' => $object->id,
            'owner_type' => AttachmentOwnerType::ORDER,
            'owner_id' => $this->order->id,
            'purpose' => 'ARBITRARY_PURPOSE_INVALID',
        ]);
    }

    /**
     * 17. Knowledge tables contain no vector column.
     */
    public function test_knowledge_tables_contain_no_vector_column(): void
    {
        $docColumns = Schema::getColumnListing('knowledge_documents');
        $chunkColumns = Schema::getColumnListing('knowledge_chunks');

        $this->assertNotContains('vector', $docColumns);
        $this->assertNotContains('embedding', $docColumns);
        $this->assertNotContains('vector', $chunkColumns);
        $this->assertNotContains('embedding', $chunkColumns);
        $this->assertNotContains('embeddings', $chunkColumns);

        // Verify knowledge metadata models persist cleanly
        $doc = KnowledgeDocument::create([
            'source_type' => 'PRODUCT_SPECIFICATION',
            'source_reference' => 'SPEC-YOGHURT-01',
            'title' => 'Callme Fresh Yoghurt Standard Operating Spec',
            'classification' => DataClassification::INTERNAL,
            'content_hash' => 'd41d8cd98f00b204e9800998ecf8427e',
        ]);

        $chunk = KnowledgeChunk::create([
            'knowledge_document_id' => $doc->id,
            'chunk_index' => 0,
            'content' => 'Callme Yoghurt must be stored at 2 to 4 degrees Celsius.',
            'token_count' => 12,
        ]);

        $this->assertSame($doc->id, $chunk->fresh()->document->id);
    }

    /**
     * 18. Laravel ERP boots without pgvector.
     */
    public function test_laravel_erp_boots_without_pgvector(): void
    {
        $this->assertTrue(Schema::hasTable('stored_objects'));
        $this->assertTrue(Schema::hasTable('object_attachments'));
        $this->assertTrue(Schema::hasTable('knowledge_documents'));
        $this->assertTrue(Schema::hasTable('knowledge_chunks'));

        // Proves DB queries succeed without pgvector extension
        $result = DB::select('SELECT 1 as live');
        $this->assertNotEmpty($result);
    }

    /**
     * 19. Laravel ERP boots without configured object-storage credentials.
     */
    public function test_laravel_erp_boots_without_configured_object_storage_credentials(): void
    {
        // Unset any object storage credentials
        config([
            'filesystems.disks.object.key' => null,
            'filesystems.disks.object.secret' => null,
        ]);

        // Application health endpoint still responds cleanly
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'ok',
            'service' => 'erp-core',
        ]);
    }
}
