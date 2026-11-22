<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';
$app = require __DIR__ . '/../../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminUser;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockReservation;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use App\Domain\Sales\Enums\DeliveryMethod;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use App\Domain\Sales\Models\OrderLine;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

// Strict safety check before touching anything:
$currentEnv = config('app.env');
$currentDb = config('database.connections.pgsql.database');
$liveDb = DB::selectOne('SELECT current_database() as db')->db ?? null;

if ($currentEnv !== 'testing' || $currentDb !== 'callme_yoghurt_test' || $liveDb !== 'callme_yoghurt_test') {
    fwrite(STDERR, "FATAL SAFETY GUARD: Seeding aborted! Current target is not isolated test DB [{$liveDb} / {$currentEnv}]\n");
    exit(1);
}

echo "=== Seeding Isolated Test Database [{$liveDb}] ===\n";

DB::transaction(function () {
    // 1. Admin User
    $admin = AdminUser::query()->firstOrCreate(
        ['email' => 'admin.test@callmeyoghurt.com'],
        [
            'id' => '0191ebc5-9257-7817-8025-a13156dc8888',
            'name' => 'Lead Admin (Test Fixture)',
            'password_hash' => Hash::make('synthetic-test-password-only'),
            'role' => AdminRole::OWNER,
            'status' => AdminStatus::ACTIVE,
        ]
    );

    // 2. Unit of Measure
    $uom = UnitOfMeasure::query()->firstOrCreate(
        ['code' => 'ML'],
        ['name' => 'Milliliters', 'category' => 'VOLUME']
    );

    // 3. Warehouse
    $warehouse = Warehouse::query()->firstOrCreate(
        ['code' => 'WH-MAIN'],
        ['name' => 'Central Cold Chain Hub', 'active' => true]
    );

    // 4. Products & Variants
    // Plain Pure Original
    $itemPlain = InventoryItem::query()->firstOrCreate(
        ['code' => 'CY-FG-PLO-500'],
        [
            'name' => 'Plain Pure Original 500ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $uom->id,
            'lot_tracked' => true,
            'active' => true,
        ]
    );

    $prodPlain = Product::query()->firstOrCreate(
        ['slug' => 'plain-pure-original'],
        [
            'id' => '0191ebc5-9257-7817-8025-a13156dc0001',
            'name' => 'Plain Pure Original',
            'description' => 'Original Greek Yogurt',
            'active' => true,
        ]
    );

    $varPlain = ProductVariant::query()->firstOrCreate(
        ['sku' => 'CY-VAR-PLO-500'],
        [
            'id' => '0191ebc5-9257-7817-8025-a13156dc0002',
            'product_id' => $prodPlain->id,
            'inventory_item_id' => $itemPlain->id,
            'variant_name' => 'Plain 500ml',
            'net_content_quantity' => '500.000000',
            'net_content_uom_id' => $uom->id,
            'shipping_weight_grams' => 520,
            'active' => true,
        ]
    );

    ProductVariantPrice::query()->firstOrCreate(
        ['product_variant_id' => $varPlain->id, 'currency' => 'IDR'],
        [
            'amount' => 30000,
            'active' => true,
            'effective_from' => now()->subDay(),
        ]
    );

    // Blueberry Velvet Bliss
    $itemBlue = InventoryItem::query()->firstOrCreate(
        ['code' => 'CY-FG-BVB-500'],
        [
            'name' => 'Blueberry Velvet Bliss 500ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $uom->id,
            'lot_tracked' => true,
            'active' => true,
        ]
    );

    $prodBlue = Product::query()->firstOrCreate(
        ['slug' => 'blueberry-velvet-bliss'],
        [
            'id' => '0191ebc5-9257-7817-8025-a13156dc0003',
            'name' => 'Blueberry Velvet Bliss',
            'description' => 'Blueberry Greek Yogurt',
            'active' => true,
        ]
    );

    $varBlue = ProductVariant::query()->firstOrCreate(
        ['sku' => 'CY-VAR-BVB-500'],
        [
            'id' => '0191ebc5-9257-7817-8025-a13156dc0004',
            'product_id' => $prodBlue->id,
            'inventory_item_id' => $itemBlue->id,
            'variant_name' => 'Blueberry 500ml',
            'net_content_quantity' => '500.000000',
            'net_content_uom_id' => $uom->id,
            'shipping_weight_grams' => 520,
            'active' => true,
        ]
    );

    ProductVariantPrice::query()->firstOrCreate(
        ['product_variant_id' => $varBlue->id, 'currency' => 'IDR'],
        [
            'amount' => 32000,
            'active' => true,
            'effective_from' => now()->subDay(),
        ]
    );

    // 5. Inventory Lots
    InventoryLot::query()->firstOrCreate(
        ['lot_number' => 'LOT-TEST-PLO-001'],
        [
            'inventory_item_id' => $itemPlain->id,
            'warehouse_id' => $warehouse->id,
            'initial_quantity' => 100,
            'available_quantity' => 90,
            'allocated_quantity' => 0,
            'reserved_quantity' => 10,
            'manufactured_at' => now()->subDays(2),
            'expires_at' => now()->addDays(28),
        ]
    );

    InventoryLot::query()->firstOrCreate(
        ['lot_number' => 'LOT-TEST-BVB-001'],
        [
            'inventory_item_id' => $itemBlue->id,
            'warehouse_id' => $warehouse->id,
            'initial_quantity' => 100,
            'available_quantity' => 95,
            'allocated_quantity' => 0,
            'reserved_quantity' => 5,
            'manufactured_at' => now()->subDays(2),
            'expires_at' => now()->addDays(28),
        ]
    );

    // 6. Test Orders & Reservations
    // Order 1: CY-20261010-RESERVED-001 (Fully reserved single line, READY)
    $order1 = Order::query()->firstOrCreate(
        ['order_number' => 'CY-20261010-RESERVED-001'],
        [
            'shipping_name' => 'Budi Santoso',
            'shipping_phone' => '081234567890',
            'shipping_address' => 'Jl. Bambu Apus No. 12, Jakarta Timur',
            'delivery_method' => DeliveryMethod::NEXTDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 60000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 77000,
            'shipping_quote_id' => 'Q-TEST-RES-001',
        ]
    );

    $line1 = OrderLine::query()->firstOrCreate(
        ['order_id' => $order1->id, 'product_variant_id' => $varPlain->id],
        [
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]
    );

    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line1->id],
        [
            'inventory_item_id' => $itemPlain->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => '2.000000',
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    // Order 2: CY-20261010-DONE-UNVERIFIED (COMPLETED order, unverified payment)
    $order2 = Order::query()->firstOrCreate(
        ['order_number' => 'CY-20261010-DONE-UNVERIFIED'],
        [
            'shipping_name' => 'Siti Rahmawati',
            'shipping_phone' => '089876543210',
            'shipping_address' => 'Jl. Kebon Jeruk No. 44, Jakarta Barat',
            'delivery_method' => DeliveryMethod::INSTANT,
            'status' => OrderStatus::DONE,
            'subtotal_amount' => 32000,
            'shipping_fee' => 15000,
            'service_fee' => 2000,
            'total_amount' => 49000,
            'shipping_quote_id' => 'Q-TEST-DONE-002',
        ]
    );

    $line2 = OrderLine::query()->firstOrCreate(
        ['order_id' => $order2->id, 'product_variant_id' => $varBlue->id],
        [
            'quantity' => '1.000000',
            'unit_price' => 32000,
            'subtotal' => 32000,
        ]
    );

    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line2->id],
        [
            'inventory_item_id' => $itemBlue->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => '1.000000',
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    // Order 3: CY-20261010-PARTIAL-001 (Ordered 4, reserved 2 -> PARTIAL)
    $order3 = Order::query()->firstOrCreate(
        ['order_number' => 'CY-20261010-PARTIAL-001'],
        [
            'shipping_name' => 'Ahmad Hidayat',
            'shipping_phone' => '081399887766',
            'shipping_address' => 'Jl. Fast Track No. 8, Jakarta Selatan',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 120000,
            'shipping_fee' => 20000,
            'service_fee' => 2000,
            'total_amount' => 142000,
            'shipping_quote_id' => 'Q-TEST-PART-003',
        ]
    );

    $line3 = OrderLine::query()->firstOrCreate(
        ['order_id' => $order3->id, 'product_variant_id' => $varPlain->id],
        [
            'quantity' => '4.000000',
            'unit_price' => 30000,
            'subtotal' => 120000,
        ]
    );

    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line3->id],
        [
            'inventory_item_id' => $itemPlain->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => '2.000000', // only 2 reserved of 4
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    // Order 4: CY-20261010-MULTILINE-001 (Multi-line: 2 items on line 1 via two separate reservations, 1 on line 2)
    $order4 = Order::query()->firstOrCreate(
        ['order_number' => 'CY-20261010-MULTILINE-001'],
        [
            'shipping_name' => 'Dewi Lestari',
            'shipping_phone' => '081255443322',
            'shipping_address' => 'Jl. Menteng Raya No. 19, Jakarta Pusat',
            'delivery_method' => DeliveryMethod::SAMEDAY,
            'status' => OrderStatus::CONFIRMED,
            'subtotal_amount' => 92000,
            'shipping_fee' => 18000,
            'service_fee' => 2000,
            'total_amount' => 112000,
            'shipping_quote_id' => 'Q-TEST-MULTI-004',
        ]
    );

    $line4a = OrderLine::query()->firstOrCreate(
        ['order_id' => $order4->id, 'product_variant_id' => $varPlain->id],
        [
            'quantity' => '2.000000',
            'unit_price' => 30000,
            'subtotal' => 60000,
        ]
    );

    $line4b = OrderLine::query()->firstOrCreate(
        ['order_id' => $order4->id, 'product_variant_id' => $varBlue->id],
        [
            'quantity' => '1.000000',
            'unit_price' => 32000,
            'subtotal' => 32000,
        ]
    );

    // 2 separate reservations of 1 each for line4a
    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line4a->id, 'quantity' => '1.000000'],
        [
            'inventory_item_id' => $itemPlain->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line4a->id, 'quantity' => '1.000001'], // slightly different for unique if needed
        [
            'inventory_item_id' => $itemPlain->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    StockReservation::query()->firstOrCreate(
        ['reference_type' => 'ORDER_LINE', 'reference_id' => (string) $line4b->id],
        [
            'inventory_item_id' => $itemBlue->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => '1.000000',
            'status' => 'RESERVED',
            'expires_at' => now()->addHours(24),
        ]
    );

    echo "Successfully seeded test admin, 2 products, 2 variants, and 4 test orders with reservations.\n";
});
