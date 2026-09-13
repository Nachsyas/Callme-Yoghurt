<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE order_lines ADD CONSTRAINT check_order_lines_quantity CHECK (quantity > 0);');
        DB::statement('ALTER TABLE order_lines ADD CONSTRAINT check_order_lines_unit_price CHECK (unit_price >= 0);');
        DB::statement('ALTER TABLE order_lines ADD CONSTRAINT check_order_lines_subtotal CHECK (subtotal >= 0);');

        DB::statement('ALTER TABLE stock_reservations ALTER COLUMN status DROP DEFAULT;');
        DB::statement('ALTER TABLE stock_reservations ADD CONSTRAINT check_stock_reservations_quantity CHECK (quantity > 0);');
        DB::statement("ALTER TABLE stock_reservations ADD CONSTRAINT check_stock_reservations_status CHECK (status IN ('RESERVED', 'RELEASED', 'CONSUMED', 'EXPIRED', 'CANCELLED'));");

        DB::statement('ALTER TABLE stock_allocations ADD CONSTRAINT check_stock_allocations_quantity CHECK (quantity > 0);');

        DB::statement('CREATE UNIQUE INDEX customers_phone_bindex_unique ON customers (phone_bindex) WHERE phone_bindex IS NOT NULL;');

        DB::statement('
            CREATE OR REPLACE FUNCTION fn_check_stock_allocation_item_integrity()
            RETURNS TRIGGER AS $$
            DECLARE
                res_item_id UUID;
                lot_item_id UUID;
            BEGIN
                SELECT inventory_item_id INTO res_item_id FROM stock_reservations WHERE id = NEW.stock_reservation_id;
                SELECT inventory_item_id INTO lot_item_id FROM inventory_lots WHERE id = NEW.inventory_lot_id;
                IF res_item_id IS DISTINCT FROM lot_item_id THEN
                    RAISE EXCEPTION \'Stock allocation item mismatch: reservation item % does not match lot item %\', res_item_id, lot_item_id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ');

        DB::statement('
            CREATE TRIGGER trg_check_stock_allocation_item_integrity
            BEFORE INSERT OR UPDATE ON stock_allocations
            FOR EACH ROW
            EXECUTE FUNCTION fn_check_stock_allocation_item_integrity();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_check_stock_allocation_item_integrity ON stock_allocations;');
        DB::statement('DROP FUNCTION IF EXISTS fn_check_stock_allocation_item_integrity();');

        DB::statement('DROP INDEX IF EXISTS customers_phone_bindex_unique;');

        DB::statement('ALTER TABLE stock_allocations DROP CONSTRAINT IF EXISTS check_stock_allocations_quantity;');

        DB::statement('ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS check_stock_reservations_status;');
        DB::statement('ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS check_stock_reservations_quantity;');
        DB::statement("ALTER TABLE stock_reservations ALTER COLUMN status SET DEFAULT 'PENDING';");

        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_subtotal;');
        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_unit_price;');
        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_quantity;');
    }
};
