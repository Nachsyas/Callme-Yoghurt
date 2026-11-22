<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminUser;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class AdminInventoryManagementTest extends TestCase
{
    use RefreshDatabase;

    private string $serviceToken = 'test-erp-service-token-secret-64ch';
    private AdminUser $owner;
    private UnitOfMeasure $uomPcs;
    private Warehouse $warehouse;

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

        $this->uomPcs = UnitOfMeasure::create([
            'code' => 'PCS',
            'name' => 'Pieces',
            'category' => 'UNIT',
        ]);

        $this->warehouse = Warehouse::create([
            'code' => 'WH-MAIN',
            'name' => 'Main Warehouse',
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

    public function test_can_list_inventory_items(): void
    {
        $item = InventoryItem::create([
            'code' => 'RAW-SUGAR',
            'name' => 'Gula Pasir Alami',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => false,
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/inventory/items');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'items' => [
                ['id', 'code', 'name', 'type', 'base_uom', 'stock' => ['on_hand', 'reserved', 'available']]
            ]
        ]);
        $response->assertJsonFragment(['code' => 'RAW-SUGAR']);
    }

    public function test_can_create_inventory_item_and_rejects_duplicate_code(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/items', [
                'code' => 'PKG-BOTTLE-250',
                'name' => 'Botol 250ml HDPE Food Grade',
                'type' => 'PACKAGING',
                'base_uom_id' => $this->uomPcs->id,
                'lot_tracked' => false,
                'active' => true,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('inventory_items', [
            'code' => 'PKG-BOTTLE-250',
            'type' => 'PACKAGING',
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'INVENTORY_ITEM_CREATED',
            'admin_user_id' => $this->owner->id,
        ]);

        // Duplicate code rejected
        $duplicate = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/items', [
                'code' => 'PKG-BOTTLE-250',
                'name' => 'Duplicate item',
                'type' => 'PACKAGING',
                'base_uom_id' => $this->uomPcs->id,
            ]);
        $duplicate->assertStatus(422);
    }

    public function test_can_update_and_deactivate_inventory_item(): void
    {
        $item = InventoryItem::create([
            'code' => 'RAW-MILK',
            'name' => 'Fresh Cow Milk',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'active' => true,
        ]);

        $updateRes = $this->withHeaders($this->authHeaders())
            ->putJson('/api/internal/admin/inventory/items/' . $item->id, [
                'name' => 'Susu Sapi Murni Pasteurisasi',
            ]);
        $updateRes->assertStatus(200);
        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'name' => 'Susu Sapi Murni Pasteurisasi',
        ]);

        $deactivateRes = $this->withHeaders($this->authHeaders())
            ->deleteJson('/api/internal/admin/inventory/items/' . $item->id);
        $deactivateRes->assertStatus(200);
        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'active' => false,
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'INVENTORY_ITEM_DEACTIVATED',
            'admin_user_id' => $this->owner->id,
        ]);
    }

    public function test_stock_receipt_workflow_creates_positive_ledger_entry_and_lot(): void
    {
        $item = InventoryItem::create([
            'code' => 'FG-PLAIN-250',
            'name' => 'Plain 250ml',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/receipts', [
                'inventory_item_id' => $item->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity' => 100,
                'lot_number' => 'LOT-PL-001',
                'production_date' => Carbon::now()->toDateString(),
                'expiration_date' => Carbon::now()->addDays(30)->toDateString(),
                'reference' => 'PO-2026-001',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('inventory_lots', [
            'inventory_item_id' => $item->id,
            'lot_number' => 'LOT-PL-001',
        ]);

        $this->assertDatabaseHas('stock_ledger_entries', [
            'inventory_item_id' => $item->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity_delta' => 100,
            'event_type' => 'STOCK_RECEIPT',
            'reference_type' => 'PURCHASE_RECEIPT',
            'reference_id' => 'PO-2026-001',
        ]);

        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'INVENTORY_STOCK_RECEIVED',
            'admin_user_id' => $this->owner->id,
        ]);

        // Verify stock total reflects in listItems()
        $listRes = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/inventory/items');
        $listRes->assertStatus(200);
        $items = collect($listRes->json('items'));
        $target = $items->firstWhere('id', $item->id);
        $this->assertEquals(100.0, $target['stock']['on_hand']);
        $this->assertEquals(100.0, $target['stock']['available']);
    }

    public function test_stock_adjustment_appends_ledger_entry_and_records_audit_reason(): void
    {
        $item = InventoryItem::create([
            'code' => 'RAW-FRUIT',
            'name' => 'Mangga Segar',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => false,
            'active' => true,
        ]);

        // First receipt of 50 units
        $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/receipts', [
                'inventory_item_id' => $item->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity' => 50,
            ]);

        // Adjust negative 5 for quality spoilage
        $adjRes = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/adjustments', [
                'inventory_item_id' => $item->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity_delta' => -5,
                'reference' => 'SPOIL-001',
                'reason' => 'Buah rusak saat penyortiran cold room',
            ]);

        $adjRes->assertStatus(201);

        // Verify 2 ledger entries exist (append-only)
        $this->assertDatabaseCount('stock_ledger_entries', 2);
        $this->assertDatabaseHas('stock_ledger_entries', [
            'inventory_item_id' => $item->id,
            'quantity_delta' => -5,
            'event_type' => 'STOCK_ADJUSTMENT',
            'reference_type' => 'MANUAL_ADJUSTMENT',
            'reference_id' => 'SPOIL-001',
        ]);

        // Audit log stores human-readable reason
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'INVENTORY_STOCK_ADJUSTED',
            'admin_user_id' => $this->owner->id,
        ]);
        $audit = \App\Domain\Admin\Models\AdminAuditLog::where('action', 'INVENTORY_STOCK_ADJUSTED')->first();
        $this->assertEquals('Buah rusak saat penyortiran cold room', $audit->metadata['reason']);

        // Stock reflects 45 available
        $itemsRes = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/inventory/items');
        $itemData = collect($itemsRes->json('items'))->firstWhere('id', $item->id);
        $this->assertEquals(45.0, $itemData['stock']['on_hand']);
        $this->assertEquals(45.0, $itemData['stock']['available']);
    }

    public function test_negative_adjustment_exceeding_stock_fails_closed(): void
    {
        $item = InventoryItem::create([
            'code' => 'RAW-FLAVOR',
            'name' => 'Perisa Alami',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => false,
            'active' => true,
        ]);

        // Receive 10
        $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/receipts', [
                'inventory_item_id' => $item->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity' => 10,
            ]);

        // Attempt adjustment of -20 (exceeds 10)
        $adjRes = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/inventory/adjustments', [
                'inventory_item_id' => $item->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity_delta' => -20,
                'reference' => 'EXCESS-ADJ',
                'reason' => 'Invalid count',
            ]);

        $adjRes->assertStatus(422);

        // Ledger count remains 1
        $this->assertDatabaseCount('stock_ledger_entries', 1);
    }

    public function test_stock_ledger_entry_cannot_be_updated_or_deleted(): void
    {
        $item = InventoryItem::create([
            'code' => 'IMMUTABLE-ITEM',
            'name' => 'Test Item',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'active' => true,
        ]);

        $entry = StockLedgerEntry::create([
            'inventory_item_id' => $item->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity_delta' => 15,
            'event_type' => 'STOCK_RECEIPT',
            'reference_type' => 'RECEIPT',
            'reference_id' => 'INIT-01',
            'occurred_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $entry->update(['quantity_delta' => 20]);
    }

    public function test_stock_ledger_entry_cannot_be_deleted(): void
    {
        $item = InventoryItem::create([
            'code' => 'IMMUTABLE-ITEM-2',
            'name' => 'Test Item 2',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomPcs->id,
            'active' => true,
        ]);

        $entry = StockLedgerEntry::create([
            'inventory_item_id' => $item->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity_delta' => 15,
            'event_type' => 'STOCK_RECEIPT',
            'reference_type' => 'RECEIPT',
            'reference_id' => 'INIT-02',
            'occurred_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $entry->delete();
    }

    public function test_can_list_lots_with_fefo_status(): void
    {
        $item = InventoryItem::create([
            'code' => 'FG-LOT-TEST',
            'name' => 'Test Yoghurt Lot',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        // Lot 1: Critical (expires in 4 days)
        $lotCritical = InventoryLot::create([
            'inventory_item_id' => $item->id,
            'lot_number' => 'LOT-CRIT-001',
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(4)->toDateString(),
            'received_at' => now(),
        ]);

        // Lot 2: Available (expires in 40 days)
        $lotAvailable = InventoryLot::create([
            'inventory_item_id' => $item->id,
            'lot_number' => 'LOT-AVAIL-001',
            'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(40)->toDateString(),
            'received_at' => now(),
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/inventory/lots?item_id=' . $item->id);

        $response->assertStatus(200);
        $lots = collect($response->json('lots'));

        $crit = $lots->firstWhere('lot_number', 'LOT-CRIT-001');
        $this->assertEquals('Critical', $crit['fefo_status']);

        $avail = $lots->firstWhere('lot_number', 'LOT-AVAIL-001');
        $this->assertEquals('Available', $avail['fefo_status']);
    }

    public function test_can_list_uoms_and_warehouses_meta(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/inventory/meta');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'uoms' => [['id', 'code', 'name']],
            'warehouses' => [['id', 'code', 'name']],
        ]);
        $response->assertJsonFragment(['code' => 'PCS']);
        $response->assertJsonFragment(['code' => 'WH-MAIN']);
    }
}
