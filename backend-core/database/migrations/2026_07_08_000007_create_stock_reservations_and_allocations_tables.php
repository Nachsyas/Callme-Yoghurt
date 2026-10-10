<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_reservations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->string('reference_type', 100);
            $table->string('reference_id', 100);
            $table->decimal('quantity', 18, 6);
            $table->string('status', 30)->default('PENDING');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
            $table->index(['inventory_item_id', 'warehouse_id', 'status']);
        });

        Schema::create('stock_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('stock_reservation_id')->constrained('stock_reservations')->cascadeOnDelete();
            $table->foreignUuid('inventory_lot_id')->constrained('inventory_lots')->restrictOnDelete();
            $table->decimal('quantity', 18, 6);
            $table->timestamps();

            $table->unique(['stock_reservation_id', 'inventory_lot_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_allocations');
        Schema::dropIfExists('stock_reservations');
    }
};
