<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Sales\CreateCheckoutOrderService;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use App\Domain\Shipping\Exceptions\ExpiredShippingQuoteException;
use App\Domain\Shipping\Services\DestinationNormalizationService;
use App\Infrastructure\Shipping\ShippingQuoteCacheStore;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class RedisShippingCacheIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private ProductVariant $variant;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        // Configure Redis-backed cache profile (Phase 1.7C.22A.2 Section 6)
        config([
            'cache.default' => 'redis',
            'shipping.cache_store' => 'redis',
            'inventory.fulfillment_warehouse_code' => 'WH-COLD-REDIS',
            'shipping.service_fee_idr' => 2000,
            'checkout.fingerprint_key' => 'test-checkout-fingerprint-key-32ch',
            'crm.pii_blind_index_key' => 'test-crm-pii-blind-index-key-32ch',
            'services.internal.service_token' => 'test-erp-service-token-secret-64ch',
        ]);

        $uom = UnitOfMeasure::create([
            'code' => 'PCS',
            'name' => 'Pieces',
            'category' => 'UNIT',
        ]);

        $this->warehouse = Warehouse::create([
            'code' => 'WH-COLD-REDIS',
            'name' => 'Cold Redis Fulfillment WH',
            'active' => true,
        ]);

        $item = InventoryItem::create([
            'code' => 'FG-YOG-REDIS-500',
            'name' => 'Redis Plain Pure 500ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $uom->id,
        ]);

        $product = Product::create([
            'name' => 'Callme Plain Pure',
            'slug' => 'callme-plain-pure-redis',
            'sku' => 'YOG-PLN-RDS',
            'is_active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $item->id,
            'sku' => 'YOG-PLN-RDS-500',
            'variant_name' => 'Plain 500ml',
            'weight_gram' => 500,
            'volume_ml' => 500,
            'is_active' => true,
        ]);

        ProductVariantPrice::create([
            'product_variant_id' => $this->variant->id,
            'currency' => 'IDR',
            'amount' => 30000,
            'effective_from' => now()->subDay(),
        ]);

        InventoryLot::create([
            'inventory_item_id' => $item->id,
            'warehouse_id' => $this->warehouse->id,
            'lot_number' => 'LOT-REDIS-001',
            'initial_quantity' => 100,
            'available_quantity' => 100,
            'allocated_quantity' => 0,
            'reserved_quantity' => 0,
            'manufactured_at' => now()->subDays(2),
            'expires_at' => now()->addDays(28),
        ]);
    }

    public function test_redis_connection_and_basic_read_write(): void
    {
        $store = ShippingQuoteCacheStore::getStore();
        $testKey = 'shipping_quote:test_conn_' . Str::random(8);
        $payload = [
            'quote_id' => 'Q-TEST-001',
            'courier' => 'grab',
            'service' => 'instant',
            'fee' => 15000,
        ];

        $store->put($testKey, $payload, 60);

        $retrieved = $store->get($testKey);
        $this->assertNotNull($retrieved);
        $this->assertSame('Q-TEST-001', $retrieved['quote_id']);
        $this->assertSame(15000, $retrieved['fee']);

        // Clean up
        $store->forget($testKey);
    }

    public function test_quote_cache_persistence_across_distinct_application_processes(): void
    {
        $quoteId = (string) Str::uuid();
        $testKey = "shipping_quote:{$quoteId}";

        $payload = [
            'quote_id' => $quoteId,
            'cart_fingerprint' => 'hash123',
            'destination_fingerprint' => 'dest123',
            'courier_code' => 'gojek',
            'service_code' => 'instant',
            'quoted_amount' => 18000,
            'payable_total' => 48000,
        ];

        // Process 1: Write quote into shared Redis
        $store = ShippingQuoteCacheStore::getStore();
        $store->put($testKey, $payload, 300);

        // Simulate new process by rebooting Laravel application container
        $this->refreshApplication();
        config([
            'cache.default' => 'redis',
            'shipping.cache_store' => 'redis',
        ]);

        // Process 2: Retrieve quote from shared Redis in new container instance
        $newStore = ShippingQuoteCacheStore::getStore();
        $persistedQuote = $newStore->get($testKey);

        $this->assertNotNull($persistedQuote, 'Quote must persist across separate application processes via Redis');
        $this->assertSame($quoteId, $persistedQuote['quote_id']);
        $this->assertSame(18000, $persistedQuote['quoted_amount']);

        $newStore->forget($testKey);
    }

    public function test_quote_cache_ttl_expiration_in_redis(): void
    {
        $store = ShippingQuoteCacheStore::getStore();
        $testKey = 'shipping_quote:exp_' . Str::random(8);

        // Put quote with 1-second TTL in real Redis
        $store->put($testKey, ['quote_id' => 'EXP-001'], 1);

        // Assert it exists immediately
        $this->assertNotNull($store->get($testKey));

        // Sleep 2 seconds to allow real Redis TTL expiration
        sleep(2);

        $this->assertNull($store->get($testKey), 'Quote must expire after TTL in distributed Redis');
    }

    public function test_checkout_cannot_accept_missing_or_expired_quote(): void
    {
        $this->expectException(ExpiredShippingQuoteException::class);
        $this->expectExceptionMessage('Kutipan ongkos kirim telah kedaluwarsa atau tidak ditemukan');

        $destination = [
            'postal_code' => '13880',
            'city' => 'Jakarta Timur',
            'district' => 'Cipayung',
            'address' => 'Jl. Bambu Apus No. 1',
        ];

        $payload = [
            'customer' => [
                'name' => 'Budi Santoso',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Bambu Apus No. 1',
            ],
            'destination' => $destination,
            'items' => [
                [
                    'variant_id' => $this->variant->id,
                    'quantity' => 1,
                ],
            ],
            'shipping_quote_id' => 'non-existent-or-expired-quote-id',
            'delivery_method' => 'SAMEDAY',
        ];

        $checkoutService = app(CreateCheckoutOrderService::class);
        $checkoutService->execute($payload, (string) Str::uuid());
    }

    public function test_redis_failure_produces_fail_closed_behavior(): void
    {
        // Point redis connection to an invalid/unreachable port
        config([
            'database.redis.cache.port' => 63799,
            'database.redis.default.port' => 63799,
        ]);

        // Clear existing resolved connection instances
        app('redis')->purge('cache');
        app('redis')->purge('default');

        $store = Cache::store('redis');

        $failedClosed = false;
        try {
            // Attempt to read from unreachable Redis
            $store->get('any_key');
        } catch (Throwable $e) {
            $failedClosed = true;
        }

        $this->assertTrue($failedClosed, 'Redis failure must trigger exception and fail closed');
    }
}
