<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use Illuminate\Console\Command;

class CreateOwnerCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'callme:create-owner
                            {--name= : Full name of the owner}
                            {--email= : Email address of the owner}
                            {--password= : Password for the owner (optional; will prompt securely if omitted)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Provision the initial Callme ERP OWNER administrative account with Argon2id hashing';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('====================================================');
        $this->info(' Callme ERP — Initial OWNER Provisioning');
        $this->info('====================================================');

        // 1. Gather Name
        $name = (string) ($this->option('name') ?? $this->ask('Enter Owner Full Name'));
        $name = trim($name);

        if ($name === '') {
            $this->error('Error: Name is required and cannot be empty.');
            return self::FAILURE;
        }

        // 2. Gather Email
        $rawEmail = (string) ($this->option('email') ?? $this->ask('Enter Owner Email Address'));
        $email = mb_strtolower(trim($rawEmail));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Error: '{$rawEmail}' is not a valid email address.");
            return self::FAILURE;
        }

        // Check for duplicate email (case-insensitive)
        if (AdminUser::where('email', $email)->exists()) {
            $this->error("Error: An admin user with email '{$email}' already exists.");
            return self::FAILURE;
        }

        // 3. Gather Password
        $password = (string) $this->option('password');

        if ($password === '') {
            // Interactive secure masked input
            $password = (string) $this->secret('Enter Password (minimum 8 characters)');
            $confirmation = (string) $this->secret('Confirm Password');

            if ($password !== $confirmation) {
                $this->error('Error: Password and password confirmation do not match.');
                return self::FAILURE;
            }
        }

        if (strlen($password) < 8) {
            $this->error('Error: Password must be at least 8 characters in length.');
            return self::FAILURE;
        }

        // 4. Create and Persist the OWNER user
        try {
            $user = new AdminUser();
            $user->name = $name;
            $user->email = $email;
            $user->role = AdminRole::OWNER;
            $user->status = AdminStatus::ACTIVE;
            $user->setPassword($password); // Strictly uses Hash::driver('argon2id')
            $user->save();

            // Record audit log
            AdminAuditLog::record(
                action: 'ACCOUNT_CREATED',
                adminUserId: $user->id,
                metadata: [
                    'role' => AdminRole::OWNER->value,
                    'email' => $user->email,
                    'provisioned_via' => 'artisan:callme:create-owner',
                ],
                ipAddress: '127.0.0.1',
                userAgent: 'Artisan CLI'
            );

            $this->newLine();
            $this->info('OWNER account created successfully.');
            $this->newLine();

            $this->table(
                ['Field', 'Value'],
                [
                    ['ID', $user->id],
                    ['Name', $user->name],
                    ['Email', $user->email],
                    ['Role', $user->role->value],
                    ['Status', $user->status->value],
                    ['Hash Driver', 'Argon2id'],
                    ['Created At', $user->created_at->toIso8601String()],
                ]
            );

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Failed to create OWNER account: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
