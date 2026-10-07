<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\CRM\Models\Customer;
use App\Domain\CRM\Services\PhoneBlindIndexService;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockAllocation;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Inventory\Models\StockReservation;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use App\Domain\Sales\Models\Order;
use App\Domain\Shipping\Contracts\ShippingRateProviderInterface;
use App\Domain\Shipping\Exceptions\OriginConfigurationException;
use App\Domain\Shipping\Services\ColdChainPolicyService;
use App\Domain\Shipping\Services\DestinationNormalizationService;
use App\Infrastructure\Shipping\BiteshipRateProvider;
use App\Infrastructure\Shipping\ShippingQuoteCacheStore;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShippingAuthorityAndQuoteIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private string $serviceToken = 'test-erp-service-token-secret-64ch';
    private string $fingerprintKey = 'test-checkout-fingerprint-key-32ch';
    private string $blindIndexKey = 'test-crm-pii-blind-index-key-32ch';

    private UnitOfMeasure $uom;
    private Warehouse $warehouse;
    private InventoryItem $inventoryItem;
    private Product $product;
    private ProductVariant $variantMeasured;
    private ProductVariant $variantUnmeasured;
    private ProductVariantPrice $price;
    private InventoryLot $lot;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.internal.service_token' => $this->serviceToken,
            'checkout.fingerprint_key' => $this->fingerprintKey,
            'crm.pii_blind_index_key' => $this->blindIndexKey,
            'inventory.fulfillment_warehouse_code' => 'WH-COLD-MAIN',
            'shipping.service_fee_idr' => 1000,
            'shipping.biteship.api_key' => 'test-biteship-api-key',
        ]);

        $this->uom = UnitOfMeasure::create([
            'code' => 'PCS',
            'name' => 'Pieces',
            'category' => 'UNIT',
        ]);

        $this->warehouse = Warehouse::create([
            'code' => 'WH-COLD-MAIN',
            'name' => 'Fulfillment Warehouse Jakarta',
            'active' => true,
        ]);

        $this->inventoryItem = InventoryItem::create([
            'code' => 'FG-YOG-PLN-500',
            'name' => 'Plain Pure 500ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uom->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->product = Product::create([
            'code' => 'PRD-YOG-PLN',
            'name' => 'Plain Pure Original',
            'slug' => 'plain-pure-original',
            'description' => 'Yoghurt segar',
            'active' => true,
        ]);

        // Variant WITH measured weight
        $this->variantMeasured = ProductVariant::create([
            'product_id' => $this->product->id,
            'inventory_item_id' => $this->inventoryItem->id,
            'sku' => 'VAR-PLN-500',
            'variant_name' => '500ml',
            'net_content_quantity' => 500,
            'net_content_uom_id' => $this->uom->id,
            'shipping_weight_grams' => 600, // Explicitly measured weight
            'active' => true,
        ]);

        // Variant WITHOUT measured weight (NULL)
        $this->variantUnmeasured = ProductVariant::create([
            'product_id' => $this->product->id,
            'inventory_item_id' => $this->inventoryItem->id,
            'sku' => 'VAR-PLN-UNMEASURED',
            'variant_name' => 'Unmeasured Size',
            'net_content_quantity' => 250,
            'net_content_uom_id' => $this->uom->id,
            'shipping_weight_grams' => null, // NULL: Not yet measured
            'active' => true,
        ]);

        $this->price = ProductVariantPrice::create([
            'product_variant_id' => $this->variantMeasured->id,
            'currency' => 'IDR',
            'amount' => 30000,
            'active' => true,
        ]);

        ProductVariantPrice::create([
            'product_variant_id' => $this->variantUnmeasured->id,
            'currency' => 'IDR',
            'amount' => 16000,
            'active' => true,
        ]);

        $this->lot = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem->id,
            'lot_number' => 'LOT-2026-TEST',
            'production_date' => Carbon::now('Asia/Jakarta')->subDays(2)->toDateString(),
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(20)->toDateString(),
            'received_at' => Carbon::now('Asia/Jakarta')->subDays(2),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $this->lot->id,
            'quantity_delta' => 100,
            'event_type' => 'RECEIPT',
            'reference_type' => 'PO',
            'reference_id' => 'PO-INIT-01',
            'occurred_at' => now(),
        ]);
    }

    /**
     * Helper to mock Biteship rate provider
     */
    private function mockProvider(array $rawRates): void
    {
        $mock = new class($rawRates) implements ShippingRateProviderInterface {
            public function __construct(private array $rates) {}
            public function getRates(array $origin, array $destination, array $items): array
            {
                return $this->rates;
            }
        };

        $this->app->instance(ShippingRateProviderInterface::class, $mock);
    }

    /**
     * Requirement 2 & 6: Missing shipping_weight_grams fails closed with UNMEASURED_SHIPPING_WEIGHT
     */
    public function test_missing_shipping_weight_grams_fails_closed(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->postJson('/api/internal/shipping/quotes', [
                'destination_postal_code' => '13890',
                'city' => 'Jakarta Timur',
                'province' => 'DKI Jakarta',
                'items' => [
                    ['variant_id' => $this->variantUnmeasured->id, 'quantity' => 1],
                ],
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'error_code' => 'UNMEASURED_SHIPPING_WEIGHT',
        ]);
        $this->assertStringContainsString('belum ditimbang', $response->json('error'));
    }

    /**
     * Requirement 4 & 5: Browser cannot provide authoritative weight or price
     */
    public function test_browser_cannot_provide_authoritative_item_weight_or_price(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->postJson('/api/internal/shipping/quotes', [
                'destination_postal_code' => '13890',
                'items' => [
                    [
                        'variant_id' => $this->variantMeasured->id,
                        'quantity' => 1,
                        'weight_grams' => 250, // Forged client weight
                        'price' => 5000,       // Forged client price
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertFalse($response->json('success'));
        $this->assertStringContainsString('Client is not authoritative', json_encode($response->json('errors')));
    }

    /**
     * Requirement 7 & 8: Shipping quote has opaque server ID and resolves weight and price by variant_id
     */
    public function test_shipping_quote_generates_opaque_server_id_and_resolves_weight_and_price(): void
    {
        $this->mockProvider([
            [
                'courier_name' => 'Grab',
                'courier_code' => 'grab',
                'courier_service_name' => 'Instant',
                'courier_service_code' => 'instant',
                'service_type' => 'instant',
                'price' => 20000,
                'duration' => '1-2 hours',
                'shipment_duration_range' => '1-2',
                'shipment_duration_unit' => 'hours',
            ],
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->postJson('/api/internal/shipping/quotes', [
                'destination_postal_code' => '13890',
                'city' => 'Jakarta Timur',
                'province' => 'DKI Jakarta',
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 2],
                ],
            ]);

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertTrue($data['success']);
        $this->assertCount(1, $data['quotes']);

        $quote = $data['quotes'][0];
        $this->assertTrue(Str::isUuid($quote['quote_id']), 'Quote ID must be a cryptographically opaque UUID');
        $this->assertFalse(str_starts_with($quote['quote_id'], 'biteship_'), 'Quote ID must not be browser-constructible string');
        $this->assertEquals(20000, $quote['price']);
        $this->assertEquals(1000, $quote['service_fee']);
        $this->assertEquals(21000, $quote['total_price']);
        $this->assertEquals(ColdChainPolicyService::MANDATORY_STORAGE_WARNING, $quote['storage_warning']);

        // Check quote was cached with cart & destination fingerprints
        $cached = Cache::get("shipping_quote:{$quote['quote_id']}");
        $this->assertNotNull($cached);
        $this->assertEquals(20000, $cached['quoted_amount']);
    }

    /**
     * Requirement 9: Forged quote ID in checkout is rejected
     */
    public function test_forged_quote_id_rejected_during_checkout(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer A',
                    'whatsapp' => '081234567890',
                    'address' => 'Jl. TB Simatupang No. 1',
                ],
                'destination' => [
                    'postal_code' => '13890',
                    'city' => 'Jakarta Timur',
                    'province' => 'DKI Jakarta',
                ],
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => (string) Str::uuid(), // Forged/nonexistent in cache
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Shipping quote has expired', $response->json('error'));
    }

    /**
     * Requirement 10: Expired quote ID in checkout is rejected
     */
    public function test_expired_quote_rejected_during_checkout(): void
    {
        $quoteId = (string) Str::uuid();
        // Quote expired (never in cache or TTL elapsed)
        ShippingQuoteCacheStore::getStore()->forget("shipping_quote:{$quoteId}");

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer B',
                    'whatsapp' => '081234567891',
                    'address' => 'Jl. Cipayung Raya No. 2',
                ],
                'destination' => [
                    'postal_code' => '13890',
                    'city' => 'Jakarta Timur',
                    'province' => 'DKI Jakarta',
                ],
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Shipping quote has expired', $response->json('error'));
    }

    /**
     * Requirement 11: Quote for different cart rejected
     */
    public function test_quote_for_different_cart_rejected(): void
    {
        $quoteId = (string) Str::uuid();
        $fakeCartFingerprint = hash('sha256', json_encode([[
            'quantity' => 5,
            'variant_id' => 'different-variant',
        ]], JSON_THROW_ON_ERROR));

        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];

        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $fakeCartFingerprint,
            'destination_fingerprint' => DestinationNormalizationService::computeFingerprint($dest),
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 15000,
            'service_fee_amount' => 1000,
        ], 600);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer C',
                    'whatsapp' => '081234567892',
                    'address' => 'Jl. Bambu Wulung',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Shipping quote does not match current cart items', $response->json('error'));
    }

    /**
     * Requirement 12: Unconfigured service fee in ERP blocks checkout commitment
     */
    public function test_unconfigured_service_fee_blocks_order_commitment(): void
    {
        config(['shipping.service_fee_idr' => null]); // Owner has not configured service fee

        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];
        $destFingerprint = DestinationNormalizationService::computeFingerprint($dest);

        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        $pRow = [
            'quantity' => 1,
            'subtotal' => 30000,
            'unit_price' => 30000,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($pRow);
        $priceFingerprint = hash('sha256', json_encode([$pRow], JSON_THROW_ON_ERROR));

        $quoteId = (string) Str::uuid();
        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => $destFingerprint,
            'price_fingerprint' => $priceFingerprint,
            'product_subtotal' => 30000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 20000,
            'service_fee_amount' => null,
        ], 600);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer D',
                    'whatsapp' => '081234567893',
                    'address' => 'Jl. Bina Marga No. 10',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertEquals('BLOCKED — OWNER FEE VALUE REQUIRED', $response->json('error'));
    }

    /**
     * Requirement 13, 14, 15: Client cannot forge shipping or service fee, and Laravel computes grand total
     */
    public function test_client_cannot_forge_fees_and_laravel_computes_grand_total(): void
    {
        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];

        // 1. Client trying to pass shipping_fee or service_fee is rejected by request validation
        $forbiddenResponse = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer E',
                    'whatsapp' => '081234567894',
                    'address' => 'Jl. Ceger No. 4',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_fee' => 5000, // Client tries to forge shipping fee
                'service_fee' => 100,  // Client tries to forge service fee
            ]);

        $forbiddenResponse->assertStatus(422);
        $this->assertNotEmpty($forbiddenResponse->json('errors'));

        // 2. Legitimate quote checkout computes authoritative grand total:
        // subtotal (30.000) + shipping (25.000) + service fee (1.000) = 56.000
        $quoteId = (string) Str::uuid();
        $destFingerprint = DestinationNormalizationService::computeFingerprint($dest);

        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        $pRow = [
            'quantity' => 1,
            'subtotal' => 30000,
            'unit_price' => 30000,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($pRow);
        $priceFingerprint = hash('sha256', json_encode([$pRow], JSON_THROW_ON_ERROR));

        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => $destFingerprint,
            'price_fingerprint' => $priceFingerprint,
            'product_subtotal' => 30000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 25000,
            'service_fee_amount' => 1000,
        ], 600);

        $successResponse = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer E',
                    'whatsapp' => '081234567894',
                    'address' => 'Jl. Ceger No. 4',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $successResponse->assertStatus(201);
        $orderData = $successResponse->json();
        $this->assertEquals(56000, $orderData['total_amount']);

        /** @var Order $order */
        $order = Order::find($orderData['order_id']);
        $this->assertNotNull($order);
        $this->assertEquals(30000, $order->subtotal_amount);
        $this->assertEquals(25000, $order->shipping_fee);
        $this->assertEquals(1000, $order->service_fee);
        $this->assertEquals(56000, $order->total_amount);
        $this->assertEquals($quoteId, $order->shipping_quote_id);
        $this->assertEquals('grab', $order->shipping_courier);
        $this->assertEquals('instant', $order->shipping_service);
    }

    /**
     * Requirement 16: Checkout idempotency includes shipping quote ID
     */
    public function test_checkout_idempotency_includes_shipping_quote_id(): void
    {
        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];
        $destFingerprint = DestinationNormalizationService::computeFingerprint($dest);

        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        $pRow = [
            'quantity' => 1,
            'subtotal' => 30000,
            'unit_price' => 30000,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($pRow);
        $priceFingerprint = hash('sha256', json_encode([$pRow], JSON_THROW_ON_ERROR));

        $quoteId1 = (string) Str::uuid();
        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId1}", [
            'quote_id' => $quoteId1,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => $destFingerprint,
            'price_fingerprint' => $priceFingerprint,
            'product_subtotal' => 30000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 20000,
            'service_fee_amount' => 1000,
        ], 600);

        $sharedIdempotencyKey = (string) Str::uuid();
        $basePayload = [
            'customer' => [
                'name' => 'Customer Replay',
                'whatsapp' => '081234567895',
                'address' => 'Jl. Hankam Raya',
            ],
            'destination' => $dest,
            'items' => [
                ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
            ],
            'delivery_method' => 'instant',
            'shipping_quote_id' => $quoteId1,
        ];

        // 1. Initial request creates order (201)
        $res1 = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', $sharedIdempotencyKey)
            ->postJson('/api/internal/orders', $basePayload);
        $res1->assertStatus(201);
        $orderId = $res1->json('order_id');

        // 2. Replay with identical payload & quote returns 200 replay
        $res2 = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', $sharedIdempotencyKey)
            ->postJson('/api/internal/orders', $basePayload);
        $res2->assertStatus(200);
        $this->assertEquals($orderId, $res2->json('order_id'));

        // 3. Replay with different shipping quote ID returns 409 Conflict (semantic differentiation)
        $quoteId2 = (string) Str::uuid();
        $diffPayload = $basePayload;
        $diffPayload['shipping_quote_id'] = $quoteId2;

        $res3 = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', $sharedIdempotencyKey)
            ->postJson('/api/internal/orders', $diffPayload);
        $res3->assertStatus(409);
        $this->assertStringContainsString('Idempotency key reused with different request payload', $res3->json('error'));
    }

    /**
     * Requirement 19, 20, 21: Cold Chain SOP 01 Time-Gating and Cutoff tests
     */
    public function test_cold_chain_policy_time_gating_and_cutoffs(): void
    {
        $policy = new ColdChainPolicyService();

        // Jakarta boundary: Monday 16:59 WIB -> same day dispatch
        $monBeforeCutoff = Carbon::parse('2026-10-05 16:59:00', 'Asia/Jakarta');
        $dispatchJakartaBefore = $policy->calculateDispatchWindow(true, $monBeforeCutoff);
        $this->assertTrue($dispatchJakartaBefore['is_same_day_dispatch']);
        $this->assertEquals('2026-10-05', $dispatchJakartaBefore['dispatch_date']);

        // Jakarta boundary: Monday 17:00 WIB -> next day dispatch
        $monAtCutoff = Carbon::parse('2026-10-05 17:00:00', 'Asia/Jakarta');
        $dispatchJakartaAfter = $policy->calculateDispatchWindow(true, $monAtCutoff);
        $this->assertFalse($dispatchJakartaAfter['is_same_day_dispatch']);
        $this->assertEquals('2026-10-06', $dispatchJakartaAfter['dispatch_date']);

        // Outside Jakarta boundary: Monday 13:59 WIB -> same day dispatch
        $outsideBefore = Carbon::parse('2026-10-05 13:59:00', 'Asia/Jakarta');
        $dispatchOutsideBefore = $policy->calculateDispatchWindow(false, $outsideBefore);
        $this->assertTrue($dispatchOutsideBefore['is_same_day_dispatch']);
        $this->assertEquals('2026-10-05', $dispatchOutsideBefore['dispatch_date']);

        // Outside Jakarta boundary: Monday 14:00 WIB -> next day dispatch
        $outsideAfter = Carbon::parse('2026-10-05 14:00:00', 'Asia/Jakarta');
        $dispatchOutsideAfter = $policy->calculateDispatchWindow(false, $outsideAfter);
        $this->assertFalse($dispatchOutsideAfter['is_same_day_dispatch']);
        $this->assertEquals('2026-10-06', $dispatchOutsideAfter['dispatch_date']);

        // Sunday non-working day: Sunday order -> Monday dispatch
        $sunday = Carbon::parse('2026-10-11 10:00:00', 'Asia/Jakarta'); // Sunday
        $dispatchSunday = $policy->calculateDispatchWindow(true, $sunday);
        $this->assertFalse($dispatchSunday['is_same_day_dispatch']);
        $this->assertEquals('2026-10-12', $dispatchSunday['dispatch_date']); // Monday
    }

    /**
     * Requirement 13, 16 & 18: Enforces strict Cold Chain matrix and neutralizes unsupported packaging claims
     */
    public function test_blocks_couriers_exceeding_three_days_and_neutralizes_claims(): void
    {
        $policy = new ColdChainPolicyService();

        $rates = [
            // Compliant Jakarta: Instant
            [
                'courier_code' => 'grab',
                'courier_service_code' => 'instant',
                'service_type' => 'instant',
                'duration' => '1 - 2 hours',
                'shipment_duration_range' => '1-2',
                'shipment_duration_unit' => 'hours',
                'price' => 20000,
            ],
            // Regular service: Blocked in Jakarta (instant/sameday only)
            [
                'courier_code' => 'jne',
                'courier_service_code' => 'reg',
                'service_type' => 'regular',
                'duration' => '1 - 2 days',
                'shipment_duration_range' => '1-2',
                'shipment_duration_unit' => 'days',
                'price' => 12000,
            ],
            // Non-compliant: 4-6 days (> 3 days)
            [
                'courier_code' => 'sicepat',
                'courier_service_code' => 'cargo',
                'service_type' => 'regular',
                'duration' => '4 - 6 days',
                'shipment_duration_range' => '4-6',
                'shipment_duration_unit' => 'days',
                'price' => 9000,
            ],
            // Nextday service: Compliant outside Jakarta
            [
                'courier_code' => 'sicepat',
                'courier_service_code' => 'best',
                'service_type' => 'next_day',
                'duration' => '1 day',
                'shipment_duration_range' => '1',
                'shipment_duration_unit' => 'days',
                'price' => 18000,
            ],
        ];

        // 1. Jakarta: Instant allowed, reg/cargo/next_day blocked
        $filteredJakarta = $policy->filterRates($rates, ['city' => 'Jakarta Timur', 'province' => 'DKI Jakarta']);
        $this->assertCount(1, $filteredJakarta);
        $this->assertEquals('instant', $filteredJakarta[0]['service_code']);

        // 2. Outside Jakarta: Nextday allowed, instant/reg/cargo blocked
        $filteredOutside = $policy->filterRates($rates, ['city' => 'Bandung', 'province' => 'Jawa Barat']);
        $this->assertCount(1, $filteredOutside);
        $this->assertEquals('best', $filteredOutside[0]['service_code']);

        // Prove description does NOT contain unsupported Icepack/Insulated claims
        foreach (array_merge($filteredJakarta, $filteredOutside) as $quote) {
            $this->assertStringNotContainsString('Icepack', $quote['description']);
            $this->assertStringNotContainsString('Insulated', $quote['description']);
            $this->assertStringNotContainsString('0–5°C', $quote['description']);
            $this->assertEquals(ColdChainPolicyService::SAFE_HANDLING_DESCRIPTION, $quote['description']);
            $this->assertEquals(ColdChainPolicyService::MANDATORY_STORAGE_WARNING, $quote['storage_warning']);
        }
    }

    /**
     * Requirement 12: Biteship Authorization header must NOT have Bearer prefix
     */
    public function test_biteship_authorization_header_does_not_contain_bearer_prefix(): void
    {
        Http::fake([
            'https://api.biteship.com/v1/rates/couriers' => Http::response([
                'success' => true,
                'pricing' => [],
            ], 200),
        ]);

        config([
            'shipping.biteship.api_key' => 'biteship_test_secret_key_123',
            'shipping.origin.postal_code' => '13890',
            'shipping.origin.latitude' => -6.3056,
            'shipping.origin.longitude' => 106.8924,
            'shipping.origin.is_verified' => true,
        ]);

        $provider = new BiteshipRateProvider();
        $provider->getRates(
            ['postal_code' => '13890', 'latitude' => -6.3056, 'longitude' => 106.8924, 'is_verified' => true],
            ['postal_code' => '10110', 'latitude' => -6.1754, 'longitude' => 106.8272],
            [['name' => 'Item', 'value' => 30000, 'quantity' => 1, 'weight_grams' => 600]]
        );

        Http::assertSent(function ($request) {
            $authHeader = $request->header('Authorization')[0] ?? '';
            return $authHeader === 'biteship_test_secret_key_123'
                && !str_starts_with($authHeader, 'Bearer ');
        });
    }

    /**
     * Requirement 13: Incomplete or unverified origin fails closed
     */
    public function test_incomplete_or_unverified_origin_fails_closed(): void
    {
        config([
            'shipping.origin.postal_code' => null, // Missing verified origin postal code
            'shipping.origin.is_verified' => false,
        ]);

        $this->expectException(\App\Domain\Shipping\Exceptions\ShippingProviderException::class);
        $provider = new BiteshipRateProvider();
        $provider->getRates([], [], []);
    }

    /**
     * Requirement 4: Destination mismatch rejects checkout
     */
    public function test_checkout_rejects_quote_when_destination_fingerprint_mismatches(): void
    {
        $destQuote = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];
        $destCheckout = [
            'postal_code' => '10110', // Different destination!
            'city' => 'Jakarta Pusat',
            'province' => 'DKI Jakarta',
        ];

        $quoteId = (string) Str::uuid();
        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => DestinationNormalizationService::computeFingerprint($destQuote),
            'price_fingerprint' => 'test_price_hash',
            'product_subtotal' => 30000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 20000,
            'service_fee_amount' => 1000,
        ], 600);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer Mismatch',
                    'whatsapp' => '081234567899',
                    'address' => 'Jl. Kebon Sirih',
                ],
                'destination' => $destCheckout,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Shipping quote does not match destination location', $response->json('error'));
    }

    /**
     * Requirement 7: Price change rejects quote with QUOTE_REPRICE_REQUIRED
     */
    public function test_checkout_rejects_quote_when_variant_price_changes_reprice_required(): void
    {
        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];

        $quoteId = (string) Str::uuid();
        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        // Quote was created with subtotal 25000 (different from current DB price 30000)
        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => DestinationNormalizationService::computeFingerprint($dest),
            'price_fingerprint' => 'stale_fingerprint',
            'product_subtotal' => 25000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 20000,
            'service_fee_amount' => 1000,
        ], 600);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer Reprice',
                    'whatsapp' => '081234567898',
                    'address' => 'Jl. Raya Bogor',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('QUOTE_REPRICE_REQUIRED', $response->json('error'));
        $this->assertEquals('QUOTE_REPRICE_REQUIRED', $response->json('error_code'));
    }

    /**
     * Requirement 8: Service fee change rejects quote with QUOTE_STALE_FEE
     */
    public function test_checkout_rejects_quote_when_service_fee_changes_stale_fee(): void
    {
        $dest = [
            'postal_code' => '13890',
            'city' => 'Jakarta Timur',
            'province' => 'DKI Jakarta',
        ];

        $quoteId = (string) Str::uuid();
        $cartRow = [
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($cartRow);
        $cartFingerprint = hash('sha256', json_encode([$cartRow], JSON_THROW_ON_ERROR));

        $pRow = [
            'quantity' => 1,
            'subtotal' => 30000,
            'unit_price' => 30000,
            'variant_id' => strtolower($this->variantMeasured->id),
        ];
        ksort($pRow);
        $priceFingerprint = hash('sha256', json_encode([$pRow], JSON_THROW_ON_ERROR));

        // Quote was created with service fee 500, but config is 1000
        ShippingQuoteCacheStore::getStore()->put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
            'destination_fingerprint' => DestinationNormalizationService::computeFingerprint($dest),
            'price_fingerprint' => $priceFingerprint,
            'product_subtotal' => 30000,
            'courier_code' => 'grab',
            'service_code' => 'instant',
            'quoted_amount' => 20000,
            'service_fee_amount' => 500, // Stale!
        ], 600);

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer Fee Change',
                    'whatsapp' => '081234567897',
                    'address' => 'Jl. Raya Bogor No. 20',
                ],
                'destination' => $dest,
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('QUOTE_STALE_FEE', $response->json('error'));
        $this->assertEquals('QUOTE_STALE_FEE', $response->json('error_code'));
    }

    /**
     * Requirement 17: Unparseable transit duration fails closed
     */
    public function test_unparseable_or_unknown_courier_transit_duration_fails_closed(): void
    {
        $policy = new ColdChainPolicyService();

        $rates = [
            [
                'courier_code' => 'unknown',
                'courier_service_code' => 'mystery',
                'service_type' => 'instant',
                'duration' => 'Uncertain transit schedule',
                'shipment_duration_range' => '',
                'shipment_duration_unit' => '',
                'price' => 15000,
            ],
            [
                'courier_code' => 'unknown2',
                'courier_service_code' => 'tbd',
                'service_type' => 'instant',
                'duration' => '',
                'shipment_duration_range' => '',
                'shipment_duration_unit' => '',
                'price' => 15000,
            ],
        ];

        $filtered = $policy->filterRates($rates, ['city' => 'Jakarta Timur', 'province' => 'DKI Jakarta']);
        $this->assertEmpty($filtered);
    }

    /**
     * Requirement 15: Production environment requires redis store or fails closed
     */
    public function test_shipping_quote_cache_store_fails_closed_in_production_if_redis_unavailable(): void
    {
        $originalEnv = app()->environment();
        // Simulate production environment
        $this->app->detectEnvironment(fn() => 'production');
        config(['shipping.cache_store' => 'file']); // Non-redis in production

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Production Redis quote store is unavailable. Failing closed.');

        try {
            ShippingQuoteCacheStore::getStore();
        } finally {
            $this->app->detectEnvironment(fn() => $originalEnv);
            config(['shipping.cache_store' => null]);
        }
    }
}
