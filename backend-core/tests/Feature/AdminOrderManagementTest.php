<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminUser;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Sales\Enums\DeliveryMethod;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use App\Domain\Sales\Models\OrderLine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderManagementTest extends TestCase
{
    use RefreshDatabase;

    private string $serviceToken = 'test-erp-service-token-secret-64ch';
    private AdminUser $owner;
    private ProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.internal.service_token' => $this->serviceToken]);

        $this->owner = new AdminUser();
        $this->owner->name = 'Owner User';
        $this->owner->email = 'owner@callmeyoghurt.com';
        $this->owner->setPassword('StrongPassword1234!');
        $this->owner->role = AdminRole::OWNER;
        $this->owner->status = AdminStatus::ACTIVE;
        $this->owner->save();

        $uom = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliters',
            'category' => 'VOLUME',
        ]);

        $item = InventoryItem::create([
            'code' => 'FG-PLAIN-500',
            'name' => 'Plain 500ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $uom->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $product = Product::create([
            'name' => 'Plain Pure Original',
            'slug' => 'plain',
            'description' => 'Original natural plain yoghurt',
            'active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $item->id,
            'sku' => 'CY-PLAIN-500',
            'variant_name' => 'Plain 500ml',
            'net_content_quantity' => '500.000000',
            'net_content_uom_id' => $uom->id,
            'shipping_weight_grams' => 520,
            'active' => true,
        ]);
    }

    private function authHeaders(?AdminUser $user = null): array
    {
        $actor = $user ?? $this->owner;
        return [
            'Authorization' => 'Bearer ' . $this->serviceToken,
            'X-Admin-User-Id' => (string) $actor->id,
            'X-Admin-Role' => $actor->role->value,
        ];
    }

    public function test_admin_orders_requires_authentication(): void
    {
        // Missing service token
        $response = $this->getJson('/api/internal/admin/orders');
        $response->assertStatus(401);

        // Missing admin actor
        $response = $this->withHeaders(['Authorization' => 'Bearer ' . $this->serviceToken])
            ->getJson('/api/internal/admin/orders');
        $response->assertStatus(403);
    }

    public function test_admin_can_list_orders_from_postgresql(): void
    {
        $order = Order::create([
            'order_number' => 'CY-20261008-TEST001',
            'shipping_name' => 'Budi Santoso',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jl. Bambu Apus No. 12, Jakarta Timur',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 30000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 47000,
        ]);

        OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '1.000000',
            'unit_price' => 30000,
            'subtotal' => 30000,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        $data = $response->json();
        $this->assertCount(1, $data['orders']);
        $this->assertSame('CY-20261008-TEST001', $data['orders'][0]['order_number']);
        $this->assertSame('Budi Santoso', $data['orders'][0]['customer']['name']);
        $this->assertSame('081234567890', $data['orders'][0]['customer']['whatsapp']);
        $this->assertSame('WAITING_PAYMENT', $data['orders'][0]['order_status']);
        $this->assertSame(47000, $data['orders'][0]['cost']['total_amount']);
        $this->assertCount(1, $data['orders'][0]['items']);
        $this->assertSame('Plain Pure Original', $data['orders'][0]['items'][0]['product_name']);

        // Check metrics
        $this->assertSame(1, $data['metrics']['today_orders']);
        $this->assertSame(1, $data['metrics']['waiting_payment']);
        $this->assertSame(47000, $data['metrics']['total_revenue']);
    }

    public function test_admin_can_get_order_detail(): void
    {
        $order = Order::create([
            'order_number' => 'CY-20261008-DETAIL1',
            'shipping_name' => 'Siti Rahma',
            'shipping_phone' => '081987654321',
            'shipping_address' => 'Jl. Raya Cipayung No. 5',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::DONE,
            'subtotal_amount' => 60000,
            'shipping_fee' => 20000,
            'service_fee' => 2000,
            'total_amount' => 82000,
        ]);

        OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]);

        // Query by UUID
        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'order' => [
                'id' => (string) $order->id,
                'order_number' => 'CY-20261008-DETAIL1',
                'customer' => [
                    'name' => 'Siti Rahma',
                ],
                'order_status' => 'COMPLETED',
                'cost' => [
                    'total_amount' => 82000,
                ],
            ],
        ]);

        // Query by order_number
        $responseByNum = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/CY-20261008-DETAIL1');
        $responseByNum->assertStatus(200);
        $this->assertSame((string) $order->id, $responseByNum->json('order.id'));
    }

    public function test_admin_order_detail_returns_404_for_nonexistent_order(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/0191ebc5-9257-7817-8025-a13156dc9999');

        $response->assertStatus(404);
        $response->assertJson([
            'error' => 'Pesanan tidak ditemukan',
        ]);
    }

    public function test_admin_orders_filter_by_status(): void
    {
        Order::create([
            'order_number' => 'CY-ORD-1',
            'shipping_name' => 'Cust 1',
            'shipping_phone' => '0811111111',
            'shipping_address' => 'Addr 1',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 30000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 42000,
        ]);

        Order::create([
            'order_number' => 'CY-ORD-2',
            'shipping_name' => 'Cust 2',
            'shipping_phone' => '0822222222',
            'shipping_address' => 'Addr 2',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CANCELLED,
            'subtotal_amount' => 30000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 42000,
        ]);

        // Filter WAITING_PAYMENT
        $resWaiting = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders?status=WAITING_PAYMENT');
        $resWaiting->assertStatus(200);
        $this->assertCount(1, $resWaiting->json('orders'));
        $this->assertSame('CY-ORD-1', $resWaiting->json('orders.0.order_number'));

        // Filter CANCELLED
        $resCancelled = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders?status=CANCELLED');
        $resCancelled->assertStatus(200);
        $this->assertCount(1, $resCancelled->json('orders'));
        $this->assertSame('CY-ORD-2', $resCancelled->json('orders.0.order_number'));
    }

    public function test_order_status_done_does_not_imply_paid_and_fulfillment_is_completed(): void
    {
        $order = Order::create([
            'order_number' => 'CY-DONE-001',
            'shipping_name' => 'Customer Done',
            'shipping_phone' => '081299998888',
            'shipping_address' => 'Jl. Kebon Jeruk',
            'delivery_method' => DeliveryMethod::INSTANT,
            'status' => OrderStatus::DONE,
            'subtotal_amount' => 50000,
            'shipping_fee' => 20000,
            'service_fee' => 2000,
            'total_amount' => 72000,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $response->assertStatus(200);
        $data = $response->json('order');

        // Order status is COMPLETED, NOT DELIVERED (no delivery proof authority in this phase)
        $this->assertSame('COMPLETED', $data['order_status']);

        // Payment status must NEVER be assumed PAID without authoritative payment proof
        $this->assertSame('PENDING_PAYMENT', $data['payment']['status']);
        $this->assertSame('waiting_verification', $data['payment']['proof_status']);

        // Inventory without reservation must be PENDING, not fabricated RESERVED
        $this->assertSame('PENDING', $data['inventory']['status']);
        $this->assertSame('PENDING', $data['inventory']['summary_status']);
        $this->assertSame('', $data['inventory']['reservation_id']);
    }

    public function test_confirmed_status_does_not_imply_recognized_revenue_and_metrics_are_authoritative(): void
    {
        // 1 Confirmed order
        Order::create([
            'order_number' => 'CY-METRIC-1',
            'shipping_name' => 'Cust A',
            'shipping_phone' => '081234',
            'shipping_address' => 'Addr A',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 40000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 52000,
        ]);

        // 1 Done order
        Order::create([
            'order_number' => 'CY-METRIC-2',
            'shipping_name' => 'Cust B',
            'shipping_phone' => '085678',
            'shipping_address' => 'Addr B',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::DONE,
            'subtotal_amount' => 30000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 47000,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders');

        $response->assertStatus(200);
        $metrics = $response->json('metrics');

        // Gross Order Value is 52000 + 47000 = 99000
        $this->assertSame(99000, $metrics['gross_order_value']);
        // Phase 1.7C.22A.2 Section 8: Unverified payments include both CONFIRMED and DONE orders
        $this->assertSame(99000, $metrics['pending_payments_value']);
        $this->assertSame(99000, $metrics['unverified_payment_value']);
        $this->assertNull($metrics['verified_payment_value']);

        // Settled and recognized revenues must be strictly null / NOT_TRACKED without verification ledgers
        $this->assertNull($metrics['settled_revenue']);
        $this->assertNull($metrics['recognized_revenue']);
        $this->assertSame('NOT_TRACKED', $metrics['settlement_status']);
        $this->assertSame(99000, $metrics['total_revenue']);
    }

    public function test_inventory_reservation_derives_truthfully_from_stock_reservation(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-MAIN',
            'name' => 'Main Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-RESERVE-001',
            'shipping_name' => 'Cust Reserved',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jl. Bambu Apus',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 30000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 42000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '1.000000',
            'unit_price' => 30000,
            'subtotal' => 30000,
        ]);

        // Create authoritative StockReservation for this order line
        $reservation = \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '1.000000',
            'status' => 'RESERVED',
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $response->assertStatus(200);
        $data = $response->json('order');

        // Status is derived from the real reservation record
        $this->assertSame((string) $reservation->id, $data['inventory']['reservation_id']);
        $this->assertSame('RESERVED', $data['inventory']['status']);
        $this->assertSame('READY', $data['inventory']['summary_status']);
    }

    public function test_multi_line_order_reservation_aggregation(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-MULTI-AGG',
            'name' => 'Multi Agg Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-MULTI-001',
            'shipping_name' => 'Multi Item Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jl. Tebet No. 10',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 60000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 77000,
        ]);

        $line1 = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '1.000000',
            'unit_price' => 30000,
            'subtotal' => 30000,
        ]);

        $line2 = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '1.000000',
            'unit_price' => 30000,
            'subtotal' => 30000,
        ]);

        // Reserve only line 1; line 2 has no reservation record
        $res1 = \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line1->id,
            'quantity' => '1.000000',
            'status' => 'RESERVED',
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $response->assertStatus(200);
        $data = $response->json('order');

        // Aggregation must be PARTIAL because line 1 is RESERVED and line 2 is PENDING
        $this->assertSame('PARTIAL', $data['inventory']['status']);
        $this->assertSame('PARTIAL', $data['inventory']['summary_status']);
        $this->assertCount(2, $data['inventory']['items']);
        $this->assertSame('RESERVED', $data['inventory']['items'][0]['status']);
        $this->assertSame(1, $data['inventory']['items'][0]['reserved_quantity']);
        $this->assertNull($data['inventory']['items'][0]['available_stock']);
        $this->assertSame('PENDING', $data['inventory']['items'][1]['status']);
        $this->assertSame(0, $data['inventory']['items'][1]['reserved_quantity']);
        $this->assertNull($data['inventory']['items'][1]['available_stock']);
    }

    public function test_admin_orders_bounded_server_side_pagination(): void
    {
        for ($i = 1; $i <= 25; $i++) {
            Order::create([
                'order_number' => sprintf('CY-PAG-%03d', $i),
                'shipping_name' => "Customer {$i}",
                'shipping_phone' => '0812345678',
                'shipping_address' => 'Jakarta',
                'delivery_method' => DeliveryMethod::NEXTDAY,
                'status' => OrderStatus::CONFIRMED,
                'subtotal_amount' => 10000,
                'shipping_fee' => 5000,
                'service_fee' => 1000,
                'total_amount' => 16000,
            ]);
        }

        // Default page 1, 20 items per page
        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders');

        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'orders',
            'metrics',
            'pagination' => ['current_page', 'per_page', 'total', 'last_page'],
        ]);

        $this->assertCount(20, $res->json('orders'));
        $this->assertSame(1, $res->json('pagination.current_page'));
        $this->assertSame(20, $res->json('pagination.per_page'));
        $this->assertSame(25, $res->json('pagination.total'));
        $this->assertSame(2, $res->json('pagination.last_page'));

        // Page 2 should contain remaining 5
        $resPage2 = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders?page=2&per_page=20');
        $this->assertCount(5, $resPage2->json('orders'));
        $this->assertSame(2, $resPage2->json('pagination.current_page'));

        // Max per_page cap at 100 (clamped)
        $resMax = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders?per_page=500');
        $this->assertSame(100, $resMax->json('pagination.per_page'));
    }

    public function test_admin_orders_deterministic_ordering(): void
    {
        $o1 = Order::create([
            'order_number' => 'CY-ORD-DET-1',
            'shipping_name' => 'Det 1',
            'shipping_phone' => '0811',
            'shipping_address' => 'A',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 10000,
            'shipping_fee' => 5000,
            'service_fee' => 1000,
            'total_amount' => 16000,
        ]);

        $o2 = Order::create([
            'order_number' => 'CY-ORD-DET-2',
            'shipping_name' => 'Det 2',
            'shipping_phone' => '0822',
            'shipping_address' => 'B',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 10000,
            'shipping_fee' => 5000,
            'service_fee' => 1000,
            'total_amount' => 16000,
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders');

        $orders = $res->json('orders');
        // Latest created order must be first
        $this->assertSame('CY-ORD-DET-2', $orders[0]['order_number']);
        $this->assertSame('CY-ORD-DET-1', $orders[1]['order_number']);
    }

    public function test_empty_database_returns_genuine_zero_metrics(): void
    {
        // No orders created in test database
        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders');

        $response->assertStatus(200);
        $this->assertSame([], $response->json('orders'));
        $metrics = $response->json('metrics');

        $this->assertSame(0, $metrics['today_orders']);
        $this->assertSame(0, $metrics['waiting_payment']);
        $this->assertSame(0, $metrics['completed_orders']);
        $this->assertSame(0, $metrics['cancelled_orders']);
        $this->assertSame(0, $metrics['gross_order_value']);
        $this->assertSame(0, $metrics['pending_payments_value']);
        $this->assertNull($metrics['settled_revenue']);
        $this->assertNull($metrics['recognized_revenue']);
        $this->assertNull($metrics['verified_payment_value']);
        $this->assertSame('NOT_TRACKED', $metrics['settlement_status']);
        $this->assertSame(0, $metrics['total_revenue']);
    }

    public function test_multiple_reservations_per_line_sum_correctly(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-MULTI-RES',
            'name' => 'Multi Res Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-MULTI-RES-001',
            'shipping_name' => 'Multi Res Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jakarta',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 90000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 107000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '3.000000',
            'unit_price' => 30000,
            'subtotal' => 90000,
        ]);

        // Reservation 1: quantity 1
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '1.000000',
            'status' => 'RESERVED',
        ]);

        // Reservation 2: quantity 2
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '2.000000',
            'status' => 'RESERVED',
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $res->assertStatus(200);
        $data = $res->json('order');

        // Total reserved is 1 + 2 = 3 >= 3 -> fully RESERVED
        $this->assertSame('RESERVED', $data['inventory']['status']);
        $this->assertSame('READY', $data['inventory']['summary_status']);
        $this->assertSame(3, $data['inventory']['items'][0]['reserved_quantity']);
        $this->assertSame('RESERVED', $data['inventory']['items'][0]['status']);
    }

    public function test_partial_reservation_when_quantity_less_than_ordered(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-PART-RES',
            'name' => 'Part Res Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-PART-RES-001',
            'shipping_name' => 'Part Res Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jakarta',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 150000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 167000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '5.000000',
            'unit_price' => 30000,
            'subtotal' => 150000,
        ]);

        // Reserved only 2 of 5
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '2.000000',
            'status' => 'RESERVED',
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $res->assertStatus(200);
        $data = $res->json('order');

        $this->assertSame('PARTIAL', $data['inventory']['status']);
        $this->assertSame('PARTIAL', $data['inventory']['summary_status']);
        $this->assertSame(2, $data['inventory']['items'][0]['reserved_quantity']);
        $this->assertSame('PARTIAL', $data['inventory']['items'][0]['status']);
    }

    public function test_expired_reservation_is_excluded_from_active_inventory(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-EXP-RES',
            'name' => 'Exp Res Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-EXP-RES-001',
            'shipping_name' => 'Exp Res Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jakarta',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 60000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 72000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]);

        // Reservation expired 1 hour ago
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '2.000000',
            'status' => 'RESERVED',
            'expires_at' => now()->subHour(),
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $res->assertStatus(200);
        $data = $res->json('order');

        // Expired reservation must not be treated as available/ready
        $this->assertSame('PENDING', $data['inventory']['status']);
        $this->assertSame('PENDING', $data['inventory']['summary_status']);
        $this->assertSame(0, $data['inventory']['items'][0]['reserved_quantity']);
        $this->assertSame('PENDING', $data['inventory']['items'][0]['status']);
    }

    public function test_released_reservation_is_excluded_from_active_inventory(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-REL-RES',
            'name' => 'Rel Res Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-REL-RES-001',
            'shipping_name' => 'Rel Res Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jakarta',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 60000,
            'shipping_fee' => 10000,
            'service_fee' => 2000,
            'total_amount' => 72000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]);

        // Reservation released
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $line->id,
            'quantity' => '2.000000',
            'status' => 'RELEASED',
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $res->assertStatus(200);
        $data = $res->json('order');

        // Released reservation must not count
        $this->assertSame('PENDING', $data['inventory']['status']);
        $this->assertSame('PENDING', $data['inventory']['summary_status']);
        $this->assertSame(0, $data['inventory']['items'][0]['reserved_quantity']);
        $this->assertSame('PENDING', $data['inventory']['items'][0]['status']);
    }

    public function test_order_level_reservation_does_not_falsely_mark_multi_line_order_ready(): void
    {
        $warehouse = \App\Domain\Inventory\Models\Warehouse::create([
            'code' => 'WH-ORD-ISO',
            'name' => 'Ord Iso Warehouse',
            'active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'CY-ORD-ISO-001',
            'shipping_name' => 'Ord Iso Cust',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jakarta',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 60000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 77000,
        ]);

        OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]);

        OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]);

        // Order-level reservation created with no direct line mappings
        \App\Domain\Inventory\Models\StockReservation::create([
            'inventory_item_id' => $this->variant->inventory_item_id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER',
            'reference_id' => (string) $order->id,
            'quantity' => '2.000000',
            'status' => 'RESERVED',
        ]);

        $res = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/orders/' . $order->id);

        $res->assertStatus(200);
        $data = $res->json('order');

        // Lines have no line reservations, so lines are PENDING and order cannot be READY
        $this->assertNotSame('READY', $data['inventory']['summary_status']);
        $this->assertSame('PENDING', $data['inventory']['items'][0]['status']);
        $this->assertSame('PENDING', $data['inventory']['items'][1]['status']);
    }
}
