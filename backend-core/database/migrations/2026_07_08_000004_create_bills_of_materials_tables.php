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
        Schema::create('bills_of_materials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->foreignUuid('finished_inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->string('version', 20)->default('1.0');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('bill_of_material_components', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('bill_of_material_id')->constrained('bills_of_materials')->cascadeOnDelete();
            $table->foreignUuid('component_inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->decimal('quantity', 18, 6);
            $table->timestamps();

            $table->unique(['bill_of_material_id', 'component_inventory_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bill_of_material_components');
        Schema::dropIfExists('bills_of_materials');
    }
};
