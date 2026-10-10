<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * In accordance with enterprise DevSecOps rules:
     * - NO hardcoded passwords.
     * - Only runs if INITIAL_OWNER_EMAIL and INITIAL_OWNER_PASSWORD are provided via environment.
     * - Idempotent: does not overwrite or duplicate existing admin accounts.
     */
    public function run(): void
    {
        $rawEmail = env('INITIAL_OWNER_EMAIL');
        $rawPassword = env('INITIAL_OWNER_PASSWORD');
        $name = env('INITIAL_OWNER_NAME', 'Callme ERP Owner');

        if (empty($rawEmail) || empty($rawPassword)) {
            $this->command?->info('AdminUserSeeder: Skipped (INITIAL_OWNER_EMAIL or INITIAL_OWNER_PASSWORD not set in environment).');
            return;
        }

        $email = mb_strtolower(trim((string) $rawEmail));
        $password = trim((string) $rawPassword);

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->command?->warn("AdminUserSeeder: Invalid email format in INITIAL_OWNER_EMAIL: '{$rawEmail}'. Skipping.");
            return;
        }

        if (strlen($password) < 8) {
            $this->command?->warn('AdminUserSeeder: INITIAL_OWNER_PASSWORD must be at least 8 characters long. Skipping.');
            return;
        }

        // Idempotency check: prevent duplicate insertion
        if (AdminUser::where('email', $email)->exists()) {
            $this->command?->info("AdminUserSeeder: Admin user '{$email}' already exists. Skipping.");
            return;
        }

        $user = new AdminUser();
        $user->name = trim((string) $name);
        $user->email = $email;
        $user->role = AdminRole::OWNER;
        $user->status = AdminStatus::ACTIVE;
        $user->setPassword($password); // Hashes via Argon2id
        $user->save();

        AdminAuditLog::record(
            action: 'ACCOUNT_CREATED',
            adminUserId: $user->id,
            metadata: [
                'role' => AdminRole::OWNER->value,
                'email' => $user->email,
                'provisioned_via' => 'AdminUserSeeder',
            ],
            ipAddress: '127.0.0.1',
            userAgent: 'DatabaseSeeder'
        );

        $this->command?->info("AdminUserSeeder: OWNER account '{$user->email}' provisioned successfully.");
    }
}
