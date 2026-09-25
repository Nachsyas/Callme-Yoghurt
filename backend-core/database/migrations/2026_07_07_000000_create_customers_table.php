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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            // Encrypted fields are stored as text (large string ciphertext)
            $table->text('name');
            $table->text('phone');
            $table->text('address');
            // Deterministic blind index for phone lookup/deduplication (HMAC-SHA256 hex = 64 chars)
            $table->string('phone_bindex', 64)->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
