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
        Schema::create('admin_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role', 32);
            $table->string('status', 32)->default('ACTIVE');
            $table->timestamp('last_login_at')->nullable();
            $table->unsignedInteger('failed_login_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamps();
        });

        // PostgreSQL Data Constraints
        DB::statement("ALTER TABLE admin_users ADD CONSTRAINT check_admin_users_role CHECK (role IN ('OWNER', 'ADMIN'));");
        DB::statement("ALTER TABLE admin_users ADD CONSTRAINT check_admin_users_status CHECK (status IN ('ACTIVE', 'DISABLED'));");
        DB::statement("ALTER TABLE admin_users ADD CONSTRAINT check_admin_users_email_lowercase CHECK (email = LOWER(email));");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_users');
    }
};
