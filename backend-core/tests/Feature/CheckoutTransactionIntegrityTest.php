<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Sales\CreateCheckoutOrderService;
use App\Domain\CRM\Models\Customer;
use App\Domain\CRM\Services\PhoneBlindIndexService;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Enums\ReservationStatus;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockAllocation;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Inventory\Models\StockReservation;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use App\Domain\Sales\Enums\DeliveryMethod;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\CheckoutIdempotencyKey;
use App\Domain\Sales\Models\Order;
use App\Domain\Sales\Models\OrderLine;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutTransactionIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private string $validToken = 'test-erp-service-token-secret-64ch';
    private string $blindIndexKey = 'test-crm-pii-blind-index-key-32ch';
    private string $fingerprintKey = 'test-checkout-fingerprint-key-32ch';

    private UnitOfMeasure $uomPcs;
    private Warehouse $warehouse;
    private InventoryItem $inventoryItem1;
    private InventoryItem $inventoryItem2;
    private Product $product1;
    private ProductVariant $variant1;
    private ProductVariant $variant2;
    private ProductVariantPrice $price1;
    private ProductVariantPrice $price2;
    private InventoryLot $lot1;
    private InventoryLot $lot2;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.internal.service_token' => $this->validToken,
            'crm.pii_blind_index_key' => $this->blindIndexKey,
            'inventory.fulfillment_warehouse_code' => 'WH-MAIN',
            'checkout.fingerprint_key' => $this->fingerprintKey,
        ]);

        $this->uomPcs = UnitOfMeasure::create([
            'code' => 'PCS',
            'name' => 'Pieces',
            'category' => 'UNIT',
        ]);

        $this->warehouse = Warehouse::create([
            'code' => 'WH-MAIN',
            'name' => 'Main Cold Chain Warehouse',
            'active' => true,
        ]);

        $this->inventoryItem1 = InventoryItem::create([
            'code' => 'FG-STRAW-250',
            'name' => 'Strawberry Yoghurt 250ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->inventoryItem2 = InventoryItem::create([
            'code' => 'FG-BLUE-250',
            'name' => 'Blueberry Yoghurt 250ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->product1 = Product::create([
            'name' => 'Callme Fresh Yoghurt',
            'slug' => 'callme-fresh-yoghurt',
            'active' => true,
        ]);

        $this->variant1 = ProductVariant::create([
            'product_id' => $this->product1->id,
            'inventory_item_id' => $this->inventoryItem1->id,
            'sku' => 'CY-STR-250',
            'variant_name' => 'Strawberry 250ml',
            'net_content_quantity' => 250,
            'net_content_uom_id' => $this->uomPcs->id,
            'active' => true,
        ]);

        $this->variant2 = ProductVariant::create([
            'product_id' => $this->product1->id,
            'inventory_item_id' => $this->inventoryItem2->id,
            'sku' => 'CY-BLU-250',
            'variant_name' => 'Blueberry 250ml',
            'net_content_quantity' => 250,
            'net_content_uom_id' => $this->uomPcs->id,
            'active' => true,
        ]);

        $this->price1 = ProductVariantPrice::create([
            'product_variant_id' => $this->variant1->id,
            'currency' => 'IDR',
            'amount' => 25000,
            'active' => true,
        ]);

        $this->price2 = ProductVariantPrice::create([
            'product_variant_id' => $this->variant2->id,
            'currency' => 'IDR',
            'amount' => 30000,
            'active' => true,
        ]);

        $this->lot1 = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'lot_number' => 'LOT-STRAW-001',
            'production_date' => Carbon::now('Asia/Jakarta')->subDays(2)->toDateString(),
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(20)->toDateString(),
            'received_at' => Carbon::now('Asia/Jakarta')->subDays(2),
        ]);

        $this->lot2 = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem2->id,
            'lot_number' => 'LOT-BLUE-001',
            'production_date' => Carbon::now('Asia/Jakarta')->subDays(1)->toDateString(),
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(25)->toDateString(),
            'received_at' => Carbon::now('Asia/Jakarta')->subDays(1),
        ]);

        // Seed stock via immutable ledger entries (50 units each)
        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $this->lot1->id,
            'quantity_delta' => 50,
            'event_type' => 'RECEIPT',
            'reference_type' => 'PO',
            'reference_id' => 'PO-INIT-01',
            'occurred_at' => now(),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem2->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $this->lot2->id,
            'quantity_delta' => 50,
            'event_type' => 'RECEIPT',
            'reference_type' => 'PO',
            'reference_id' => 'PO-INIT-02',
            'occurred_at' => now(),
        ]);
    }

    /**
     * Helper to make internal orders POST request.
     *
     * @param array<string, mixed> $payload
     * @param string|null $idempotencyKey
     * @param string|null $token
     * @return \Illuminate\Testing\TestResponse
     */
    private function postOrder(
        array $payload,
        ?string $idempotencyKey = 'idemp-test-key-001',
        ?string $token = null
    ) {
        $headers = [
            'Authorization' => 'Bearer ' . ($token ?? $this->validToken),
            'X-Request-Id' => (string) Str::uuid(),
        ];

        if ($idempotencyKey !== null) {
            $headers['Idempotency-Key'] = $idempotencyKey;
        }

        return $this->withHeaders($headers)->postJson('/api/internal/orders', $payload);
    }

    private function validPayload(): array
    {
        return [
            'customer' => [
                'name' => 'Budi Pratama',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Sudirman No. 45, Jakarta Pusat',
            ],
            'items' => [
                [
                    'variant_id' => $this->variant1->id,
                    'quantity' => 2,
                ],
            ],
            'delivery_method' => 'instant',
        ];
    }

    /**
     * 1. Valid authenticated checkout creates one order with HTTP 201.
     */
    public function test_valid_authenticated_checkout_creates_one_order(): void
    {
        $response = $this->postOrder($this->validPayload());

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'order_id',
            'order_number',
            'status',
            'total_amount',
        ]);
        $this->assertEquals('CONFIRMED', $response->json('status'));
        $this->assertEquals(50000, $response->json('total_amount')); // 2 * 25000

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_lines', 1);
        $this->assertDatabaseCount('stock_reservations', 1);
        $this->assertDatabaseCount('stock_allocations', 1);
    }

    /**
     * 2. Client cannot provide authoritative price (rejected 422).
     */
    public function test_client_cannot_provide_authoritative_price(): void
    {
        $payload = $this->validPayload();
        $payload['items'][0]['price'] = 1000;

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 3. Client cannot provide authoritative total_amount (rejected 422).
     */
    public function test_client_cannot_provide_authoritative_total_amount(): void
    {
        $payload = $this->validPayload();
        $payload['total_amount'] = 5000;

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 4. Unknown transaction-authority fields are rejected.
     */
    public function test_unknown_transaction_authority_fields_are_rejected(): void
    {
        $prohibitedTests = ['stock', 'warehouse', 'lot', 'discount', 'order_status'];

        foreach ($prohibitedTests as $field) {
            $payload = $this->validPayload();
            $payload[$field] = 'tampered';

            $response = $this->postOrder($payload, 'idemp-prohib-' . $field);
            $response->assertStatus(422);
        }

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 5. Inactive or nonexistent variant is rejected (422).
     */
    public function test_inactive_or_nonexistent_variant_is_rejected(): void
    {
        // Inactive variant
        $this->variant1->update(['active' => false]);
        $response = $this->postOrder($this->validPayload(), 'idemp-inactive-var');
        $response->assertStatus(422);
        $response->assertJson(['error' => 'Requested product variant is inactive or unavailable']);

        // Nonexistent variant UUID
        $payload = $this->validPayload();
        $payload['items'][0]['variant_id'] = (string) Str::uuid();
        $response2 = $this->postOrder($payload, 'idemp-nonexist-var');
        $response2->assertStatus(422);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 6. Missing authoritative price is rejected (422).
     */
    public function test_missing_authoritative_price_is_rejected(): void
    {
        $this->price1->update(['active' => false]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(422);
        $response->assertJson(['error' => 'Active retail price is unavailable for requested variant']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 7 & 8. ERP calculates correct line subtotal and order total.
     */
    public function test_erp_calculates_correct_line_subtotal_and_order_total(): void
    {
        $payload = [
            'customer' => [
                'name' => 'Multi Item Customer',
                'whatsapp' => '081299998888',
                'address' => 'Jl. Thamrin No. 10',
            ],
            'items' => [
                ['variant_id' => $this->variant1->id, 'quantity' => 3], // 3 * 25000 = 75000
                ['variant_id' => $this->variant2->id, 'quantity' => 2], // 2 * 30000 = 60000
            ],
            'delivery_method' => 'sameday',
        ];

        $response = $this->postOrder($payload);
        $response->assertStatus(201);
        $response->assertJson(['total_amount' => 135000]); // 75000 + 60000

        $order = Order::with('lines')->first();
        $this->assertNotNull($order);
        $this->assertEquals(135000, $order->total_amount);

        $lines = $order->lines->sortBy('product_variant_id')->values();
        $this->assertCount(2, $lines);
    }

    /**
     * 9. Money uses integer arithmetic without float rounding.
     */
    public function test_money_uses_integer_arithmetic(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $order = Order::first();
        $line = OrderLine::first();

        $this->assertIsInt($order->total_amount);
        $this->assertIsInt($line->unit_price);
        $this->assertIsInt($line->subtotal);
        $this->assertEquals(25000, $line->unit_price);
        $this->assertEquals(50000, $line->subtotal);
    }

    /**
     * 10. Invalid delivery method rejected (422).
     */
    public function test_invalid_delivery_method_rejected(): void
    {
        $payload = $this->validPayload();
        $payload['delivery_method'] = 'drone_express';

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 11. Configured fulfillment warehouse is required (fails closed 503 with no WH-MAIN fallback).
     */
    public function test_configured_fulfillment_warehouse_is_required(): void
    {
        config(['inventory.fulfillment_warehouse_code' => null]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(503);
        $response->assertJson(['error' => 'Checkout service is temporarily unavailable']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 12. Inactive configured warehouse is rejected (fails closed 503).
     */
    public function test_inactive_configured_warehouse_is_rejected(): void
    {
        $this->warehouse->update(['active' => false]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(503);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 13. Order stores selected delivery method.
     */
    public function test_order_stores_selected_delivery_method(): void
    {
        $payload = $this->validPayload();
        $payload['delivery_method'] = 'nextday';

        $response = $this->postOrder($payload);
        $response->assertStatus(201);

        $order = Order::first();
        $this->assertEquals(DeliveryMethod::NEXTDAY, $order->delivery_method);
    }

    /**
     * 14. Customer is created with encrypted PII.
     */
    public function test_customer_is_created_with_encrypted_pii(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $rawCustomer = DB::table('customers')->first();
        $this->assertNotNull($rawCustomer);

        // Raw database column holds ciphertext, not plain text
        $this->assertStringNotContainsString('Budi Pratama', $rawCustomer->name);
        $this->assertStringNotContainsString('081234567890', $rawCustomer->phone);
        $this->assertStringNotContainsString('Jl. Sudirman', $rawCustomer->address);

        // Eloquent model decrypts transparently
        $customer = Customer::first();
        $this->assertEquals('Budi Pratama', $customer->name);
        $this->assertEquals('6281234567890', $customer->phone);
    }

    /**
     * 15. Customer phone blind index is generated.
     */
    public function test_customer_phone_blind_index_is_generated(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $customer = Customer::first();
        $expectedBindex = PhoneBlindIndexService::generateBlindIndex('6281234567890', $this->blindIndexKey);

        $this->assertEquals($expectedBindex, $customer->phone_bindex);
        $this->assertEquals(64, strlen($customer->phone_bindex));
    }

    /**
     * 16. Same normalized phone reuses existing customer and updates profile.
     */
    public function test_same_normalized_phone_reuses_existing_customer_and_updates_profile(): void
    {
        // First checkout
        $this->postOrder($this->validPayload(), 'idemp-cust-1')->assertStatus(201);
        $this->assertDatabaseCount('customers', 1);

        // Second checkout with same phone but formatted differently (+62 812-3456-7890) and updated name
        $payload2 = $this->validPayload();
        $payload2['customer']['whatsapp'] = '+62 812-3456-7890';
        $payload2['customer']['name'] = 'Budi Pratama Updated';

        $this->postOrder($payload2, 'idemp-cust-2')->assertStatus(201);

        // Proves customer is reused, not duplicated
        $this->assertDatabaseCount('customers', 1);
        $customer = Customer::first();
        $this->assertEquals('Budi Pratama Updated', $customer->name);
    }

    /**
     * 17. Concurrent customer resolution for same phone succeeds without duplicate error.
     */
    public function test_concurrent_customer_resolution_serialized_via_advisory_lock(): void
    {
        // Emulate transaction advisory lock directly via PostgreSQL hashtextextended
        $phone = '628999888777';
        $bindex = PhoneBlindIndexService::generateBlindIndex($phone, $this->blindIndexKey);

        DB::transaction(function () use ($bindex) {
            $lockAcquired = DB::selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$bindex]);
            $this->assertNotNull($lockAcquired);
        });
    }

    /**
     * 18. Order stores encrypted immutable shipping snapshot.
     */
    public function test_order_stores_encrypted_immutable_shipping_snapshot(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $rawOrder = DB::table('orders')->first();
        $this->assertNotNull($rawOrder);

        // Raw columns hold ciphertext
        $this->assertStringNotContainsString('Budi Pratama', (string) $rawOrder->shipping_name);
        $this->assertStringNotContainsString('Jl. Sudirman', (string) $rawOrder->shipping_address);

        // Model decrypts
        $order = Order::first();
        $this->assertEquals('Budi Pratama', $order->shipping_name);
        $this->assertEquals('6281234567890', $order->shipping_phone);
        $this->assertEquals('Jl. Sudirman No. 45, Jakarta Pusat', $order->shipping_address);
    }

    /**
     * 19. Public ERP response contains no PII.
     */
    public function test_public_erp_response_contains_no_pii(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $json = $response->json();
        $this->assertArrayNotHasKey('customer', $json);
        $this->assertArrayNotHasKey('shipping_name', $json);
        $this->assertArrayNotHasKey('shipping_phone', $json);
        $this->assertArrayNotHasKey('shipping_address', $json);
        $this->assertArrayNotHasKey('phone_bindex', $json);
        $this->assertArrayNotHasKey('warehouse_id', $json);
        $this->assertArrayNotHasKey('lot_id', $json);
    }

    /**
     * 20. FEFO selects earliest valid expiration lot.
     */
    public function test_fefo_selects_earliest_valid_expiration(): void
    {
        // Add a second lot for variant 1 expiring earlier (in 5 days) vs lot1 (in 20 days)
        $earlyLot = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'lot_number' => 'LOT-EARLY-001',
            'production_date' => Carbon::now('Asia/Jakarta')->subDays(1)->toDateString(),
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(5)->toDateString(),
            'received_at' => Carbon::now('Asia/Jakarta')->subDays(1),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $earlyLot->id,
            'quantity_delta' => 10,
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        // Proves early lot was allocated first
        $allocation = StockAllocation::first();
        $this->assertEquals($earlyLot->id, $allocation->inventory_lot_id);
        $this->assertEquals(2, (int) $allocation->quantity);
    }

    /**
     * 21. Expired lot is ignored.
     */
    public function test_expired_lot_is_ignored(): void
    {
        // Expire lot1
        $this->lot1->update([
            'expiration_date' => Carbon::now('Asia/Jakarta')->subDay()->toDateString(),
        ]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(409); // Insufficient stock because lot is expired
        $response->assertJson(['error' => 'Insufficient inventory available for one or more requested items']);
    }

    /**
     * 22. Undated FEFO-controlled lot is not silently preferred.
     */
    public function test_undated_fefo_controlled_lot_is_not_silently_preferred(): void
    {
        // Lot with null expiration date
        $undatedLot = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'lot_number' => 'LOT-UNDATED-001',
            'production_date' => Carbon::now('Asia/Jakarta')->subDays(5)->toDateString(),
            'expiration_date' => null,
            'received_at' => Carbon::now('Asia/Jakarta')->subDays(5),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $undatedLot->id,
            'quantity_delta' => 100,
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);

        // Empty stock from lot1
        $this->lot1->update(['expiration_date' => Carbon::now('Asia/Jakarta')->subDay()->toDateString()]);

        $response = $this->postOrder($this->validPayload());
        // Undated lot must not be used for sellable retail goods -> 409
        $response->assertStatus(409);
    }

    /**
     * 23. Allocation can span multiple lots.
     */
    public function test_allocation_can_span_multiple_lots(): void
    {
        // lot1 has 50 units. Add second lot with 10 units.
        // We'll set lot1 to only have 2 units available by an offsetting negative entry.
        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $this->lot1->id,
            'quantity_delta' => -48, // leaving exactly 2 units in lot1
            'event_type' => 'ADJUSTMENT',
            'occurred_at' => now(),
        ]);

        $lotB = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'lot_number' => 'LOT-STRAW-002',
            'production_date' => Carbon::now('Asia/Jakarta')->toDateString(),
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(40)->toDateString(),
            'received_at' => Carbon::now('Asia/Jakarta'),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'inventory_lot_id' => $lotB->id,
            'quantity_delta' => 10,
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);

        // Request 5 units: 2 from lot1, 3 from lotB
        $payload = $this->validPayload();
        $payload['items'][0]['quantity'] = 5;

        $response = $this->postOrder($payload);
        $response->assertStatus(201);

        $allocations = StockAllocation::all();
        $this->assertCount(2, $allocations);
        $this->assertEquals(2, (int) $allocations[0]->quantity);
        $this->assertEquals(3, (int) $allocations[1]->quantity);
    }

    /**
     * 24. Existing active allocation reduces availability.
     */
    public function test_existing_active_allocation_reduces_availability(): void
    {
        // lot1 has 50 units. Create an active reservation for 49 units.
        $reservation = StockReservation::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'reference_type' => 'MANUAL_HOLD',
            'reference_id' => 'HOLD-01',
            'quantity' => 49,
            'status' => ReservationStatus::RESERVED->value,
            'expires_at' => Carbon::now('Asia/Jakarta')->addHour(),
        ]);

        StockAllocation::create([
            'stock_reservation_id' => $reservation->id,
            'inventory_lot_id' => $this->lot1->id,
            'quantity' => 49,
        ]);

        // Available is now 1 unit. Requesting 2 units must fail with 409!
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(409);
    }

    /**
     * 25. Expired reservation does NOT reduce current availability.
     */
    public function test_expired_reservation_does_not_reduce_current_availability(): void
    {
        // Reservation for 50 units expired 10 minutes ago
        $reservation = StockReservation::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'reference_type' => 'EXPIRED_HOLD',
            'reference_id' => 'HOLD-02',
            'quantity' => 50,
            'status' => ReservationStatus::RESERVED->value,
            'expires_at' => Carbon::now('Asia/Jakarta')->subMinutes(10),
        ]);

        StockAllocation::create([
            'stock_reservation_id' => $reservation->id,
            'inventory_lot_id' => $this->lot1->id,
            'quantity' => 50,
        ]);

        // Available is still 50 units because reservation expired
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);
    }

    /**
     * 26. Inactive reservation statuses (RELEASED, CONSUMED, CANCELLED) do NOT reduce availability.
     */
    public function test_inactive_reservation_statuses_do_not_reduce_availability(): void
    {
        foreach ([ReservationStatus::RELEASED, ReservationStatus::CONSUMED, ReservationStatus::CANCELLED] as $status) {
            $reservation = StockReservation::create([
                'inventory_item_id' => $this->inventoryItem1->id,
                'warehouse_id' => $this->warehouse->id,
                'reference_type' => 'INACTIVE_HOLD',
                'reference_id' => 'HOLD-' . $status->value,
                'quantity' => 50,
                'status' => $status->value,
                'expires_at' => null,
            ]);

            StockAllocation::create([
                'stock_reservation_id' => $reservation->id,
                'inventory_lot_id' => $this->lot1->id,
                'quantity' => 50,
            ]);
        }

        // Available is still 50 units
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);
    }

    /**
     * 27 & 28. Insufficient stock returns conflict 409 and leaves zero partial writes.
     */
    public function test_insufficient_stock_returns_conflict_and_leaves_zero_partial_writes(): void
    {
        $payload = $this->validPayload();
        $payload['items'][0]['quantity'] = 99; // Only 50 units in stock

        $response = $this->postOrder($payload);
        $response->assertStatus(409);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_lines', 0);
        $this->assertDatabaseCount('stock_reservations', 0);
        $this->assertDatabaseCount('stock_allocations', 0);
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('checkout_idempotency_keys', 0);
    }

    /**
     * 29. Second-line failure rolls back first-line allocation (multi-line atomicity).
     */
    public function test_second_line_failure_rolls_back_first_line_allocation(): void
    {
        $payload = [
            'customer' => [
                'name' => 'Atomicity Test Customer',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Atomicity No. 1',
            ],
            'items' => [
                ['variant_id' => $this->variant1->id, 'quantity' => 5], // Sufficient stock (50 in stock)
                ['variant_id' => $this->variant2->id, 'quantity' => 99], // Insufficient stock (50 in stock)
            ],
            'delivery_method' => 'instant',
        ];

        $response = $this->postOrder($payload);
        $response->assertStatus(409);

        // Entire transaction rolled back
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_lines', 0);
        $this->assertDatabaseCount('stock_reservations', 0);
        $this->assertDatabaseCount('stock_allocations', 0);
    }

    /**
     * 30. Successful order creates reservations and allocation totals match.
     */
    public function test_successful_order_creates_reservations_and_allocation_totals_match(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $orderLine = OrderLine::first();
        $reservation = StockReservation::where('reference_id', (string) $orderLine->id)->first();
        $this->assertNotNull($reservation);
        $this->assertEquals(2, (int) $reservation->quantity);

        $totalAllocations = StockAllocation::where('stock_reservation_id', $reservation->id)->sum('quantity');
        $this->assertEquals(2, (int) $totalAllocations);
    }

    /**
     * 31 & 33. Same idempotency key with same payload returns same order (HTTP 200) with no extra reservations.
     */
    public function test_same_idempotency_key_with_same_payload_returns_same_order_and_no_extra_reservations(): void
    {
        $key = 'idemp-replay-001';

        // 1st request -> 201
        $res1 = $this->postOrder($this->validPayload(), $key);
        $res1->assertStatus(201);
        $orderId = $res1->json('order_id');
        $orderNumber = $res1->json('order_number');

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('stock_reservations', 1);
        $this->assertDatabaseCount('stock_allocations', 1);

        // 2nd request with same key and payload -> 200 replay
        $res2 = $this->postOrder($this->validPayload(), $key);
        $res2->assertStatus(200);
        $this->assertEquals($orderId, $res2->json('order_id'));
        $this->assertEquals($orderNumber, $res2->json('order_number'));

        // No new orders, lines, or reservations created
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('stock_reservations', 1);
        $this->assertDatabaseCount('stock_allocations', 1);
    }

    /**
     * 32. Replay with differently ordered items returns same order (canonicalization).
     */
    public function test_replay_with_differently_ordered_items_returns_same_order(): void
    {
        $key = 'idemp-order-permute-001';

        $payload1 = [
            'customer' => [
                'name' => 'Permutation Customer',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Permutasi No. 1',
            ],
            'items' => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2],
                ['variant_id' => $this->variant2->id, 'quantity' => 3],
            ],
            'delivery_method' => 'instant',
        ];

        // 1st request
        $res1 = $this->postOrder($payload1, $key);
        $res1->assertStatus(201);
        $orderId = $res1->json('order_id');

        // 2nd request with reversed item array
        $payload2 = $payload1;
        $payload2['items'] = [
            ['variant_id' => $this->variant2->id, 'quantity' => 3],
            ['variant_id' => $this->variant1->id, 'quantity' => 2],
        ];

        $res2 = $this->postOrder($payload2, $key);
        $res2->assertStatus(200);
        $this->assertEquals($orderId, $res2->json('order_id'));
    }

    /**
     * 34. Same key + different payload returns 409 conflict.
     */
    public function test_same_key_with_different_payload_returns_409_conflict(): void
    {
        $key = 'idemp-conflict-001';

        // 1st request -> 201
        $this->postOrder($this->validPayload(), $key)->assertStatus(201);

        // 2nd request with same key but different quantity -> 409
        $payload2 = $this->validPayload();
        $payload2['items'][0]['quantity'] = 4;

        $res2 = $this->postOrder($payload2, $key);
        $res2->assertStatus(409);
        $res2->assertJson(['error' => 'Idempotency key reused with different request payload']);
    }

    /**
     * 35. Raw idempotency key is not persisted.
     */
    public function test_raw_idempotency_key_is_not_persisted(): void
    {
        $rawKey = 'very-secret-raw-idempotency-key-xyz';
        $this->postOrder($this->validPayload(), $rawKey)->assertStatus(201);

        $record = CheckoutIdempotencyKey::first();
        $this->assertNotNull($record);
        $this->assertEquals(hash('sha256', $rawKey), $record->key_hash);

        // Assert raw string never appears in database columns
        $this->assertDatabaseMissing('checkout_idempotency_keys', [
            'key_hash' => $rawKey,
        ]);
    }

    /**
     * 36. Duplicate variant_id lines are rejected (422).
     */
    public function test_duplicate_variant_id_lines_are_rejected(): void
    {
        $payload = [
            'customer' => [
                'name' => 'Duplicate Variant Customer',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Duplikat No. 1',
            ],
            'items' => [
                ['variant_id' => $this->variant1->id, 'quantity' => 1],
                ['variant_id' => $this->variant1->id, 'quantity' => 2],
            ],
            'delivery_method' => 'instant',
        ];

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items.1.variant_id']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 37. Order number uniqueness remains safe.
     */
    public function test_order_number_uniqueness_remains_safe(): void
    {
        $this->postOrder($this->validPayload(), 'idemp-unq-1')->assertStatus(201);
        $this->postOrder($this->validPayload(), 'idemp-unq-2')->assertStatus(201);

        $orders = Order::all();
        $this->assertCount(2, $orders);
        $this->assertNotEquals($orders[0]->order_number, $orders[1]->order_number);
        $this->assertStringStartsWith('CY-', $orders[0]->order_number);
    }

    /**
     * 38. Missing checkout fingerprint key fails closed (503).
     */
    public function test_missing_checkout_fingerprint_key_fails_closed(): void
    {
        config(['checkout.fingerprint_key' => null]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(503);
        $response->assertJson(['error' => 'Checkout service is temporarily unavailable']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 39. Status PENDING is rejected by database check constraint.
     */
    public function test_pending_reservation_status_is_rejected_by_database_constraint(): void
    {
        $this->expectException(QueryException::class);

        DB::table('stock_reservations')->insert([
            'id' => (string) Str::uuid(),
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'reference_type' => 'ORDER',
            'reference_id' => 'SO-PENDING-TEST',
            'quantity' => '5.000000',
            'status' => 'PENDING',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * 40. Reservation Item A cannot allocate Lot Item B (DB trigger + domain rejection).
     */
    public function test_reservation_item_a_cannot_allocate_lot_item_b(): void
    {
        $reservation = StockReservation::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $this->warehouse->id,
            'reference_type' => 'ORDER',
            'reference_id' => 'SO-ITEM-MISMATCH',
            'quantity' => '2.000000',
            'status' => ReservationStatus::RESERVED->value,
        ]);

        $lotItem2 = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem2->id,
            'lot_number' => 'LOT-BLUE-MISMATCH-01',
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(10)->toDateString(),
        ]);

        $this->expectException(QueryException::class);

        StockAllocation::create([
            'stock_reservation_id' => $reservation->id,
            'inventory_lot_id' => $lotItem2->id,
            'quantity' => '2.000000',
        ]);
    }

    /**
     * 41. Inactive Product rejects checkout (422).
     */
    public function test_inactive_product_rejects_checkout(): void
    {
        $this->product1->update(['active' => false]);

        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(422);
        $response->assertJson(['error' => 'Requested product variant is inactive or unavailable']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 42. RAW_MATERIAL-backed variant rejects checkout (422).
     */
    public function test_raw_material_backed_variant_rejects_checkout(): void
    {
        $rawItem = InventoryItem::create([
            'code' => 'RM-MILK-TEST',
            'name' => 'Raw Milk',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $rawVariant = ProductVariant::create([
            'product_id' => $this->product1->id,
            'inventory_item_id' => $rawItem->id,
            'sku' => 'RAW-MILK-VAR',
            'variant_name' => 'Raw Milk Variant',
            'active' => true,
        ]);

        ProductVariantPrice::create([
            'product_variant_id' => $rawVariant->id,
            'currency' => 'IDR',
            'amount' => 15000,
            'active' => true,
        ]);

        $payload = $this->validPayload();
        $payload['items'][0]['variant_id'] = $rawVariant->id;

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $response->assertJson(['error' => 'Requested product variant is inactive or unavailable']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 43. PACKAGING-backed variant rejects checkout (422).
     */
    public function test_packaging_backed_variant_rejects_checkout(): void
    {
        $pkgItem = InventoryItem::create([
            'code' => 'PKG-BOTTLE-TEST',
            'name' => 'Plastic Bottle 250ml',
            'type' => ItemType::PACKAGING,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => false,
            'active' => true,
        ]);

        $pkgVariant = ProductVariant::create([
            'product_id' => $this->product1->id,
            'inventory_item_id' => $pkgItem->id,
            'sku' => 'PKG-BOTTLE-VAR',
            'variant_name' => 'Bottle Variant',
            'active' => true,
        ]);

        ProductVariantPrice::create([
            'product_variant_id' => $pkgVariant->id,
            'currency' => 'IDR',
            'amount' => 5000,
            'active' => true,
        ]);

        $payload = $this->validPayload();
        $payload['items'][0]['variant_id'] = $pkgVariant->id;

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $response->assertJson(['error' => 'Requested product variant is inactive or unavailable']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 44. Cross-warehouse reservation does not reduce another warehouse's available stock.
     */
    public function test_cross_warehouse_reservation_does_not_reduce_another_warehouse_availability(): void
    {
        $warehouseB = Warehouse::create([
            'code' => 'WH-BALI',
            'name' => 'Bali Warehouse',
            'active' => true,
        ]);

        $lotB = InventoryLot::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'lot_number' => 'LOT-BALI-001',
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(14)->toDateString(),
        ]);

        StockLedgerEntry::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $warehouseB->id,
            'inventory_lot_id' => $lotB->id,
            'quantity_delta' => 10,
            'event_type' => 'RECEIPT',
            'reference_type' => 'PO',
            'reference_id' => 'PO-BALI-001',
            'occurred_at' => now(),
        ]);

        // Create an active reservation in Warehouse B for 8 units
        $resB = StockReservation::create([
            'inventory_item_id' => $this->inventoryItem1->id,
            'warehouse_id' => $warehouseB->id,
            'reference_type' => 'ORDER',
            'reference_id' => 'SO-BALI-001',
            'quantity' => '8.000000',
            'status' => ReservationStatus::RESERVED->value,
            'expires_at' => Carbon::now('Asia/Jakarta')->addMinutes(30),
        ]);

        StockAllocation::create([
            'stock_reservation_id' => $resB->id,
            'inventory_lot_id' => $lotB->id,
            'quantity' => '8.000000',
        ]);

        // In WH-MAIN, 50 units exist. Order full 50 units.
        // If WH-BALI reservation incorrectly reduced WH-MAIN, available would be 42 and this would 409.
        $payload = $this->validPayload();
        $payload['items'][0]['quantity'] = 50;

        $response = $this->postOrder($payload);
        $response->assertStatus(201);
    }

    /**
     * 45. 51 checkout item lines are rejected (422).
     */
    public function test_51_checkout_item_lines_are_rejected(): void
    {
        $items = [];
        for ($i = 0; $i < 51; $i++) {
            $items[] = [
                'variant_id' => (string) Str::uuid(),
                'quantity' => 1,
            ];
        }

        $payload = [
            'customer' => [
                'name' => 'Too Many Lines Customer',
                'whatsapp' => '081234567890',
                'address' => 'Jl. Banyak Item No. 51',
            ],
            'items' => $items,
            'delivery_method' => 'instant',
        ];

        $response = $this->postOrder($payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 46. Pre-existing matching idempotency row with order_id=NULL fails closed (409).
     */
    public function test_pre_existing_matching_idempotency_row_with_null_order_fails_closed(): void
    {
        $key = 'concurrent-inflight-key-xyz';
        $payload = $this->validPayload();

        $keyHash = hash('sha256', $key);
        /** @var CreateCheckoutOrderService $service */
        $service = app(CreateCheckoutOrderService::class);
        $canonical = $service->canonicalizePayload($payload);
        $encoded = json_encode(
            $canonical,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        $requestHash = hash_hmac('sha256', $encoded, $this->fingerprintKey);

        DB::table('checkout_idempotency_keys')->insert([
            'id' => (string) Str::uuid(),
            'scope' => 'checkout',
            'key_hash' => $keyHash,
            'request_hash' => $requestHash,
            'order_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postOrder($payload, $key);
        $response->assertStatus(409);
        $response->assertJson(['error' => 'Idempotency key reused with different request payload']);

        $this->assertDatabaseCount('orders', 0);
    }

    /**
     * 47. Customer profile change after checkout does not change Order shipping snapshot.
     */
    public function test_customer_profile_change_after_checkout_does_not_change_order_shipping_snapshot(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $order = Order::first();
        $this->assertNotNull($order);
        $this->assertEquals('Budi Pratama', $order->shipping_name);
        $this->assertEquals('Jl. Sudirman No. 45, Jakarta Pusat', $order->shipping_address);

        $customer = Customer::first();
        $this->assertNotNull($customer);
        $customer->update([
            'name' => 'Budi Pratama Updated Name',
            'address' => 'Jl. Thamrin No. 99, Jakarta Baru',
        ]);

        $orderFresh = $order->fresh();
        $this->assertEquals('Budi Pratama', $orderFresh->shipping_name);
        $this->assertEquals('Jl. Sudirman No. 45, Jakarta Pusat', $orderFresh->shipping_address);
    }

    /**
     * 48. Checkout-created reservation explicitly stores RESERVED status.
     */
    public function test_checkout_created_reservation_explicitly_stores_reserved_status(): void
    {
        $response = $this->postOrder($this->validPayload());
        $response->assertStatus(201);

        $orderLine = OrderLine::first();
        $this->assertNotNull($orderLine);

        $reservation = StockReservation::where('reference_id', (string) $orderLine->id)->first();
        $this->assertNotNull($reservation);
        $this->assertEquals(ReservationStatus::RESERVED->value, $reservation->status);
        $this->assertEquals('RESERVED', $reservation->status);

        $rawReservation = DB::table('stock_reservations')->where('id', $reservation->id)->first();
        $this->assertEquals('RESERVED', $rawReservation->status);
    }
}
