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

        DB::statement('ALTER TABLE stock_reservations ADD CONSTRAINT check_stock_reservations_quantity CHECK (quantity > 0);');
        DB::statement("ALTER TABLE stock_reservations ADD CONSTRAINT check_stock_reservations_status CHECK (status IN ('PENDING', 'RESERVED', 'RELEASED', 'CONSUMED', 'EXPIRED', 'CANCELLED'));");

        DB::statement('ALTER TABLE stock_allocations ADD CONSTRAINT check_stock_allocations_quantity CHECK (quantity > 0);');

        DB::statement('CREATE UNIQUE INDEX customers_phone_bindex_unique ON customers (phone_bindex) WHERE phone_bindex IS NOT NULL;');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS customers_phone_bindex_unique;');

        DB::statement('ALTER TABLE stock_allocations DROP CONSTRAINT IF EXISTS check_stock_allocations_quantity;');

        DB::statement('ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS check_stock_reservations_status;');
        DB::statement('ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS check_stock_reservations_quantity;');

        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_subtotal;');
        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_unit_price;');
        DB::statement('ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS check_order_lines_quantity;');
    }
};
