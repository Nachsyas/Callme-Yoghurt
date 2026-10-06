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
use App\Domain\Shipping\Services\ColdChainPolicyService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
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
        Cache::forget("shipping_quote:{$quoteId}");

        $response = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer B',
                    'whatsapp' => '081234567891',
                    'address' => 'Jl. Cipayung Raya No. 2',
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
        $fakeCartFingerprint = hash('sha256', json_encode([['variant_id' => 'different-variant', 'quantity' => 5]]));

        Cache::put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $fakeCartFingerprint,
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
                'items' => [
                    ['variant_id' => $this->variantMeasured->id, 'quantity' => 1],
                ],
                'delivery_method' => 'instant',
                'shipping_quote_id' => $quoteId,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Shipping quote does not match', $response->json('error'));
    }

    /**
     * Requirement 12: Unconfigured service fee in ERP blocks checkout commitment
     */
    public function test_unconfigured_service_fee_blocks_order_commitment(): void
    {
        config(['shipping.service_fee_idr' => null]); // Owner has not configured service fee

        $quoteId = (string) Str::uuid();
        $cartFingerprint = hash('sha256', json_encode([[
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ]]));

        Cache::put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
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
        // 1. Client trying to pass shipping_fee or service_fee is rejected by request validation
        $forbiddenResponse = $this->withHeader('Authorization', "Bearer {$this->serviceToken}")
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/internal/orders', [
                'customer' => [
                    'name' => 'Customer E',
                    'whatsapp' => '081234567894',
                    'address' => 'Jl. Ceger No. 4',
                ],
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
        $cartFingerprint = hash('sha256', json_encode([[
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ]]));

        Cache::put("shipping_quote:{$quoteId}", [
            'quote_id' => $quoteId,
            'cart_fingerprint' => $cartFingerprint,
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
        $quoteId1 = (string) Str::uuid();
        $cartFingerprint = hash('sha256', json_encode([[
            'quantity' => 1,
            'variant_id' => strtolower($this->variantMeasured->id),
        ]]));

        Cache::put("shipping_quote:{$quoteId1}", [
            'quote_id' => $quoteId1,
            'cart_fingerprint' => $cartFingerprint,
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
     * Requirement 13 & 18: Blocks couriers taking > 3 days and neutralizes unsupported packaging claims
     */
    public function test_blocks_couriers_exceeding_three_days_and_neutralizes_claims(): void
    {
        $policy = new ColdChainPolicyService();

        $rates = [
            // Compliant: Instant
            [
                'courier_code' => 'grab',
                'courier_service_code' => 'instant',
                'service_type' => 'instant',
                'duration' => '1 - 2 hours',
                'shipment_duration_range' => '1-2',
                'shipment_duration_unit' => 'hours',
                'price' => 20000,
            ],
            // Compliant: 1-2 days (<= 3 days)
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
        ];

        $filtered = $policy->filterRates($rates, ['city' => 'Jakarta Timur', 'province' => 'DKI Jakarta']);

        $this->assertCount(2, $filtered);
        $serviceCodes = array_column($filtered, 'service_code');
        $this->assertContains('instant', $serviceCodes);
        $this->assertContains('reg', $serviceCodes);
        $this->assertNotContains('cargo', $serviceCodes);

        // Prove description does NOT contain unsupported Icepack/Insulated claims
        foreach ($filtered as $quote) {
            $this->assertStringNotContainsString('Icepack', $quote['description']);
            $this->assertStringNotContainsString('Insulated', $quote['description']);
            $this->assertStringNotContainsString('0–5°C', $quote['description']);
            $this->assertEquals(ColdChainPolicyService::SAFE_HANDLING_DESCRIPTION, $quote['description']);
            $this->assertEquals(ColdChainPolicyService::MANDATORY_STORAGE_WARNING, $quote['storage_warning']);
        }
    }
}
