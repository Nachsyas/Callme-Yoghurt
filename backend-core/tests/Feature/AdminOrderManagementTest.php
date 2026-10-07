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
                'order_status' => 'DELIVERED',
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
}
