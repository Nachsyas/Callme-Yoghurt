<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->text('shipping_name')->nullable()->after('customer_id');
            $table->text('shipping_phone')->nullable()->after('shipping_name');
            $table->text('shipping_address')->nullable()->after('shipping_phone');
            $table->string('delivery_method', 30)->nullable()->after('shipping_address');
        });

        DB::statement('ALTER TABLE orders ADD CONSTRAINT check_orders_total_amount CHECK (total_amount >= 0);');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT check_orders_delivery_method CHECK (delivery_method IS NULL OR delivery_method IN ('instant', 'sameday', 'nextday'));");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_orders_delivery_method;');
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_orders_total_amount;');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'shipping_name',
                'shipping_phone',
                'shipping_address',
                'delivery_method',
            ]);
        });
    }
};
