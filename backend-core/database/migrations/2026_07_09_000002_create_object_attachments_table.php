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
        Schema::create('object_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('stored_object_id')->constrained('stored_objects')->cascadeOnDelete();
            $table->string('owner_type', 50);
            $table->string('owner_id', 36);
            $table->string('purpose', 50);
            $table->timestamps();

            $table->index(['owner_type', 'owner_id', 'purpose']);
            $table->index('stored_object_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE object_attachments ADD CONSTRAINT chk_object_attachments_owner_type CHECK (owner_type IN ('PRODUCT_VARIANT', 'ORDER'));");
            DB::statement("ALTER TABLE object_attachments ADD CONSTRAINT chk_object_attachments_purpose CHECK (purpose IN ('PRODUCT_IMAGE', 'INVOICE_PDF', 'COMPLAINT_EVIDENCE'));");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('object_attachments');
    }
};
