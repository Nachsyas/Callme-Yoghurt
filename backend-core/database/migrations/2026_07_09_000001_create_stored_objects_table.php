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
        Schema::create('stored_objects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('storage_disk', 50);
            $table->string('object_key', 1024);
            $table->string('bucket', 255)->nullable();
            $table->string('original_filename', 255)->nullable();
            $table->string('media_type', 150);
            $table->bigInteger('byte_size');
            $table->string('sha256', 64)->nullable();
            $table->string('classification', 50);
            $table->string('retention_class', 50);
            $table->timestamp('delete_after')->nullable();
            $table->boolean('legal_hold')->default(false);
            $table->timestamps();

            $table->unique(['storage_disk', 'object_key']);
            $table->index(['delete_after', 'legal_hold']);
            $table->index('sha256');
            $table->index('classification');
        });

        // Enforce database-level check constraints and retention trigger on PostgreSQL
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE stored_objects ADD CONSTRAINT chk_stored_objects_byte_size CHECK (byte_size >= 0);');
            DB::statement("ALTER TABLE stored_objects ADD CONSTRAINT chk_stored_objects_classification CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'));");
            DB::statement("ALTER TABLE stored_objects ADD CONSTRAINT chk_stored_objects_retention_class CHECK (retention_class IN ('HOT', 'WARM', 'COLD'));");
            DB::statement("ALTER TABLE stored_objects ADD CONSTRAINT chk_stored_objects_sha256 CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$');");

            DB::statement(<<<'SQL'
                CREATE OR REPLACE FUNCTION fn_protect_stored_objects_retention()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF OLD.legal_hold = TRUE THEN
                        RAISE EXCEPTION 'StoredObject deletion prohibited: object is under legal hold.'
                            USING ERRCODE = 'restrict_violation';
                    END IF;

                    IF OLD.delete_after IS NULL THEN
                        RAISE EXCEPTION 'StoredObject deletion prohibited: delete_after is not set.'
                            USING ERRCODE = 'restrict_violation';
                    END IF;

                    IF OLD.delete_after > CURRENT_TIMESTAMP THEN
                        RAISE EXCEPTION 'StoredObject deletion prohibited: delete_after has not expired.'
                            USING ERRCODE = 'restrict_violation';
                    END IF;

                    RETURN OLD;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER trg_protect_stored_objects_retention
                BEFORE DELETE ON stored_objects
                FOR EACH ROW
                EXECUTE FUNCTION fn_protect_stored_objects_retention();
            SQL);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TRIGGER IF EXISTS trg_protect_stored_objects_retention ON stored_objects;');
            DB::statement('DROP FUNCTION IF EXISTS fn_protect_stored_objects_retention();');
        }

        Schema::dropIfExists('stored_objects');
    }
};
