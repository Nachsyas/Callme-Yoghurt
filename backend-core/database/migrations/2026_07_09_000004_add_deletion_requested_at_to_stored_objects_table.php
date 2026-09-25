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
        Schema::table('stored_objects', function (Blueprint $table) {
            $table->timestampTz('deletion_requested_at')->nullable()->after('delete_after');
            $table->index('deletion_requested_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stored_objects', function (Blueprint $table) {
            $table->dropIndex(['deletion_requested_at']);
            $table->dropColumn('deletion_requested_at');
        });
    }
};
