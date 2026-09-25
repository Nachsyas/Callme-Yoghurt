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
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 200);
            $table->string('slug', 200)->unique();
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignUuid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->string('sku', 100)->unique();
            $table->string('variant_name', 200);
            $table->decimal('net_content_quantity', 18, 6)->nullable();
            $table->foreignUuid('net_content_uom_id')->nullable()->constrained('units_of_measure')->nullOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
    }
};
