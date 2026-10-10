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
        Schema::create('knowledge_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_type', 100);
            $table->string('source_reference', 255)->nullable();
            $table->string('title', 255);
            $table->string('classification', 50);
            $table->string('content_hash', 64)->nullable();
            $table->timestamps();

            $table->index('source_type');
            $table->index('classification');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE knowledge_documents ADD CONSTRAINT chk_knowledge_documents_classification CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'));");
        }

        Schema::create('knowledge_chunks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('knowledge_document_id')->constrained('knowledge_documents')->cascadeOnDelete();
            $table->integer('chunk_index');
            $table->text('content');
            $table->integer('token_count')->nullable();
            $table->timestamps();

            $table->unique(['knowledge_document_id', 'chunk_index']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('knowledge_chunks');
        Schema::dropIfExists('knowledge_documents');
    }
};
