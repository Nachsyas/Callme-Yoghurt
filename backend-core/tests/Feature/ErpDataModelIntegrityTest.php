<?php

declare(strict_types=1);

namespace Tests\Feature;

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
use App\Domain\Manufacturing\Models\BillOfMaterial;
use App\Domain\Manufacturing\Models\BillOfMaterialComponent;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use App\Domain\Sales\Models\OrderLine;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class ErpDataModelIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private UnitOfMeasure $uomMl;
    private UnitOfMeasure $uomPcs;
    private InventoryItem $rawMilk;
    private InventoryItem $finishedStrawberry;
    private Warehouse $mainWarehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->uomMl = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliter',
            'category' => 'VOLUME',
        ]);

        $this->uomPcs = UnitOfMeasure::create([
            'code' => 'PCS',
            'name' => 'Pieces',
            'category' => 'UNIT',
        ]);

        $this->rawMilk = InventoryItem::create([
            'code' => 'RM-MILK-001',
            'name' => 'Fresh Cow Milk',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => $this->uomMl->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->finishedStrawberry = InventoryItem::create([
            'code' => 'FG-STR-250',
            'name' => 'Callme Strawberry Yoghurt 250ml (Bulk FG)',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->mainWarehouse = Warehouse::create([
            'code' => 'WH-MAIN',
            'name' => 'Main Cold Warehouse Bandung',
            'active' => true,
        ]);
    }

    /**
     * 1. Proves Product can own multiple variants.
     */
    public function test_product_can_own_multiple_variants(): void
    {
        $product = Product::create([
            'name' => 'Callme Yoghurt Strawberry',
            'slug' => 'callme-yoghurt-strawberry',
            'description' => 'Fresh artisan strawberry yoghurt',
            'active' => true,
        ]);

        $v1 = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->finishedStrawberry->id,
            'sku' => 'CY-STR-250',
            'variant_name' => 'Strawberry 250ml',
            'net_content_quantity' => '250.000000',
            'net_content_uom_id' => $this->uomMl->id,
            'active' => true,
        ]);

        $item1000 = InventoryItem::create([
            'code' => 'FG-STR-1000',
            'name' => 'Callme Strawberry Yoghurt 1L (Bulk FG)',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomPcs->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $v2 = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $item1000->id,
            'sku' => 'CY-STR-1000',
            'variant_name' => 'Strawberry 1L',
            'net_content_quantity' => '1000.000000',
            'net_content_uom_id' => $this->uomMl->id,
            'active' => true,
        ]);

        $this->assertCount(2, $product->fresh()->variants);
        $this->assertTrue($product->variants->contains('id', $v1->id));
        $this->assertTrue($product->variants->contains('id', $v2->id));
    }

    /**
     * 2. Proves ProductVariant enforces unique SKU.
     */
    public function test_variant_has_unique_sku(): void
    {
        $product = Product::create([
            'name' => 'Callme Plain',
            'slug' => 'callme-plain',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->finishedStrawberry->id,
            'sku' => 'UNIQUE-SKU-001',
            'variant_name' => 'Original',
        ]);

        $this->expectException(QueryException::class);

        // Attempting to duplicate the SKU must violate unique constraint
        ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->finishedStrawberry->id,
            'sku' => 'UNIQUE-SKU-001',
            'variant_name' => 'Duplicate SKU Variant',
        ]);
    }

    /**
     * 3. Proves ProductVariant references a real InventoryItem (FK integrity).
     */
    public function test_variant_references_real_inventory_item(): void
    {
        $product = Product::create([
            'name' => 'Test Product',
            'slug' => 'test-product',
        ]);

        $this->expectException(QueryException::class);

        ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => (string) Str::uuid(), // Non-existent inventory item
            'sku' => 'ORPHAN-VARIANT',
            'variant_name' => 'Orphan Variant',
        ]);
    }

    /**
     * 4. Proves InventoryItem references its UOM.
     */
    public function test_inventory_item_references_its_uom(): void
    {
        $this->assertEquals($this->uomMl->id, $this->rawMilk->baseUom->id);
        $this->assertEquals('ML', $this->rawMilk->baseUom->code);

        $this->expectException(QueryException::class);

        InventoryItem::create([
            'code' => 'INVALID-UOM-ITEM',
            'name' => 'Invalid UOM Item',
            'type' => ItemType::RAW_MATERIAL,
            'base_uom_id' => (string) Str::uuid(), // Non-existent UOM
        ]);
    }

    /**
     * 5. Proves BOM component quantities persist accurately using decimal/numeric(18,6).
     */
    public function test_bom_component_quantities_persist_accurately_using_decimal_numeric(): void
    {
        $bom = BillOfMaterial::create([
            'code' => 'BOM-STR-250-V1',
            'finished_inventory_item_id' => $this->finishedStrawberry->id,
            'version' => '1.0',
            'active' => true,
        ]);

        // Exact high-precision decimal quantity (240.123456 ml milk per bottle)
        $component = BillOfMaterialComponent::create([
            'bill_of_material_id' => $bom->id,
            'component_inventory_item_id' => $this->rawMilk->id,
            'quantity' => '240.123456',
        ]);

        $fresh = $component->fresh();
        $this->assertEquals('240.123456', (string) $fresh->quantity);
        $this->assertEquals($bom->id, $fresh->billOfMaterial->id);
        $this->assertEquals($this->rawMilk->id, $fresh->componentItem->id);
    }

    /**
     * 6. Proves ledger decimal quantities preserve precision.
     */
    public function test_ledger_decimal_quantities_preserve_precision(): void
    {
        $entry = StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '12345.678901',
            'event_type' => 'RECEIPT',
            'reference_type' => 'PO',
            'reference_id' => 'PO-2026-0001',
            'occurred_at' => now(),
        ]);

        $fresh = $entry->fresh();
        $this->assertEquals('12345.678901', (string) $fresh->quantity_delta);
    }

    /**
     * 7. Proves ledger entries may be positive or negative but not zero.
     */
    public function test_ledger_entries_may_be_positive_or_negative_but_not_zero(): void
    {
        // Positive entry (Receipt)
        $pos = StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '500.000000',
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);
        $this->assertEquals('500.000000', (string) $pos->fresh()->quantity_delta);

        // Negative entry (Consumption/Sale)
        $neg = StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '-150.250000',
            'event_type' => 'PRODUCTION_CONSUMPTION',
            'occurred_at' => now(),
        ]);
        $this->assertEquals('-150.250000', (string) $neg->fresh()->quantity_delta);

        // Zero entry must be rejected
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Stock ledger entry quantity_delta cannot be zero.');

        StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '0.000000',
            'event_type' => 'ADJUSTMENT',
            'occurred_at' => now(),
        ]);
    }

    /**
     * 8. Proves ledger entry update is rejected (immutability).
     */
    public function test_ledger_entry_update_is_rejected(): void
    {
        $entry = StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '100.000000',
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Stock ledger entries are immutable and cannot be updated.');

        $entry->update(['quantity_delta' => '200.000000']);
    }

    /**
     * 9. Proves ledger entry deletion is rejected (immutability).
     */
    public function test_ledger_entry_deletion_is_rejected(): void
    {
        $entry = StockLedgerEntry::create([
            'inventory_item_id' => $this->rawMilk->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'quantity_delta' => '100.000000',
            'event_type' => 'RECEIPT',
            'occurred_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Stock ledger entries are immutable and cannot be deleted.');

        $entry->delete();
    }

    /**
     * 10. Proves InventoryLot references a real item.
     */
    public function test_lot_references_real_item(): void
    {
        $lot = InventoryLot::create([
            'inventory_item_id' => $this->rawMilk->id,
            'lot_number' => 'LOT-MILK-20260710-01',
            'production_date' => '2026-07-10',
            'expiration_date' => '2026-07-17',
        ]);

        $this->assertEquals($this->rawMilk->id, $lot->item->id);

        $this->expectException(QueryException::class);

        InventoryLot::create([
            'inventory_item_id' => (string) Str::uuid(), // Non-existent item
            'lot_number' => 'LOT-INVALID',
        ]);
    }

    /**
     * 11. Proves same lot number may not duplicate for the same item.
     */
    public function test_same_lot_number_cannot_duplicate_for_same_item(): void
    {
        InventoryLot::create([
            'inventory_item_id' => $this->rawMilk->id,
            'lot_number' => 'LOT-DUP-TEST',
            'production_date' => '2026-07-10',
        ]);

        // Same lot number for DIFFERENT item is allowed
        $otherLot = InventoryLot::create([
            'inventory_item_id' => $this->finishedStrawberry->id,
            'lot_number' => 'LOT-DUP-TEST',
            'production_date' => '2026-07-10',
        ]);
        $this->assertNotNull($otherLot->id);

        // Same lot number for SAME item must violate compound unique constraint
        $this->expectException(QueryException::class);

        InventoryLot::create([
            'inventory_item_id' => $this->rawMilk->id,
            'lot_number' => 'LOT-DUP-TEST',
            'production_date' => '2026-07-11',
        ]);
    }

    /**
     * 12. Proves StockReservation uses decimal quantity.
     */
    public function test_reservation_uses_decimal_quantity(): void
    {
        $reservation = StockReservation::create([
            'inventory_item_id' => $this->finishedStrawberry->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'reference_type' => 'ORDER',
            'reference_id' => 'SO-2026-0001',
            'quantity' => '24.500000',
            'status' => 'RESERVED',
            'expires_at' => now()->addMinutes(15),
        ]);

        $fresh = $reservation->fresh();
        $this->assertEquals('24.500000', (string) $fresh->quantity);
        $this->assertEquals('RESERVED', $fresh->status);
    }

    /**
     * 13. Proves StockAllocation belongs to reservation + real lot.
     */
    public function test_allocation_belongs_to_reservation_and_real_lot(): void
    {
        $reservation = StockReservation::create([
            'inventory_item_id' => $this->finishedStrawberry->id,
            'warehouse_id' => $this->mainWarehouse->id,
            'reference_type' => 'ORDER',
            'reference_id' => 'SO-2026-0002',
            'quantity' => '10.000000',
            'status' => 'RESERVED',
        ]);

        $lot = InventoryLot::create([
            'inventory_item_id' => $this->finishedStrawberry->id,
            'lot_number' => 'LOT-STR-20260710-01',
            'expiration_date' => '2026-07-24',
        ]);

        $allocation = StockAllocation::create([
            'stock_reservation_id' => $reservation->id,
            'inventory_lot_id' => $lot->id,
            'quantity' => '10.000000',
        ]);

        $fresh = $allocation->fresh();
        $this->assertEquals('10.000000', (string) $fresh->quantity);
        $this->assertEquals($reservation->id, $fresh->reservation->id);
        $this->assertEquals($lot->id, $fresh->lot->id);
    }

    /**
     * 14. Proves orphan allocation cannot persist without valid reservation and lot.
     */
    public function test_orphan_allocation_cannot_persist(): void
    {
        $lot = InventoryLot::create([
            'inventory_item_id' => $this->finishedStrawberry->id,
            'lot_number' => 'LOT-STR-ORPHAN',
        ]);

        $this->expectException(QueryException::class);

        StockAllocation::create([
            'stock_reservation_id' => (string) Str::uuid(), // Non-existent reservation
            'inventory_lot_id' => $lot->id,
            'quantity' => '5.000000',
        ]);
    }

    /**
     * 15. Proves OrderLine references a valid ProductVariant.
     */
    public function test_order_line_references_valid_product_variant(): void
    {
        $product = Product::create([
            'name' => 'Callme Test',
            'slug' => 'callme-test',
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->finishedStrawberry->id,
            'sku' => 'TEST-SKU-ORDER',
            'variant_name' => 'Test 250ml',
        ]);

        $order = Order::create([
            'order_number' => 'SO-2026-0100',
            'status' => OrderStatus::DRAFT,
            'total_amount' => 50000,
        ]);

        $line = OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => $variant->id,
            'quantity' => '2.000000',
            'unit_price' => 25000,
            'subtotal' => 50000,
        ]);

        $this->assertEquals($variant->id, $line->fresh()->productVariant->id);

        $this->expectException(QueryException::class);

        OrderLine::create([
            'order_id' => $order->id,
            'product_variant_id' => (string) Str::uuid(), // Non-existent variant
            'quantity' => '1.000000',
            'unit_price' => 25000,
            'subtotal' => 25000,
        ]);
    }

    /**
     * 16. Proves money is persisted without floating-point behavior using integer minor units.
     */
    public function test_money_is_persisted_without_floating_point_behavior(): void
    {
        $order = Order::create([
            'order_number' => 'SO-2026-0200',
            'status' => OrderStatus::CONFIRMED,
            'total_amount' => 1250000, // IDR 1,250,000 exact
        ]);

        $this->assertIsInt($order->fresh()->total_amount);
        $this->assertSame(1250000, $order->fresh()->total_amount);
    }

    /**
     * 17. Proves migrate:fresh succeeds on PostgreSQL and all required ERP tables exist.
     */
    public function test_schema_integrity_and_table_existence(): void
    {
        $requiredTables = [
            'customers',
            'units_of_measure',
            'inventory_items',
            'products',
            'product_variants',
            'bills_of_materials',
            'bill_of_material_components',
            'warehouses',
            'inventory_lots',
            'stock_ledger_entries',
            'stock_reservations',
            'stock_allocations',
            'orders',
            'order_lines',
        ];

        foreach ($requiredTables as $table) {
            $this->assertTrue(Schema::hasTable($table), "PostgreSQL table [{$table}] must exist");
        }
    }
}
