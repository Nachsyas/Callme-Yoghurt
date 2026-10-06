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
        // 1. Add authoritative shipping_weight_grams to product_variants
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('shipping_weight_grams')->nullable()->after('net_content_uom_id');
        });

        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT check_product_variants_shipping_weight_grams CHECK (shipping_weight_grams IS NULL OR shipping_weight_grams > 0);');

        // 2. Add committed financial breakdown and quote snapshot to orders
        Schema::table('orders', function (Blueprint $table) {
            $table->bigInteger('subtotal_amount')->default(0)->after('status');
            $table->bigInteger('shipping_fee')->default(0)->after('subtotal_amount');
            $table->bigInteger('service_fee')->default(0)->after('shipping_fee');
            $table->string('shipping_quote_id', 100)->nullable()->after('service_fee');
            $table->string('shipping_courier', 50)->nullable()->after('shipping_quote_id');
            $table->string('shipping_service', 50)->nullable()->after('shipping_courier');
        });

        DB::statement('ALTER TABLE orders ADD CONSTRAINT check_orders_subtotal_amount CHECK (subtotal_amount >= 0);');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT check_orders_shipping_fee CHECK (shipping_fee >= 0);');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT check_orders_service_fee CHECK (service_fee >= 0);');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_orders_service_fee;');
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_orders_shipping_fee;');
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_orders_subtotal_amount;');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'subtotal_amount',
                'shipping_fee',
                'service_fee',
                'shipping_quote_id',
                'shipping_courier',
                'shipping_service',
            ]);
        });

        DB::statement('ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS check_product_variants_shipping_weight_grams;');

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('shipping_weight_grams');
        });
    }
};
