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
        Schema::create('checkout_idempotency_keys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50)->default('checkout');
            $table->char('key_hash', 64);
            $table->char('request_hash', 64);
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['scope', 'key_hash']);
            $table->index('order_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('checkout_idempotency_keys');
    }
};
