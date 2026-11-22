<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class CreateOwnerCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('admin_login:owner@callmeyoghurt.com|127.0.0.1');
        RateLimiter::clear('admin_login:cli_owner@callmeyoghurt.com|127.0.0.1');
        RateLimiter::clear('admin_login:seeder_owner@callmeyoghurt.com|127.0.0.1');
    }

    /**
     * Test 1: Interactive creation of OWNER user succeeds.
     */
    public function test_can_create_owner_interactively(): void
    {
        $this->artisan('callme:create-owner')
            ->expectsQuestion('Enter Owner Full Name', 'Main Callme Owner')
            ->expectsQuestion('Enter Owner Email Address', 'OWNER@callmeyoghurt.com')
            ->expectsQuestion('Enter Password (minimum 8 characters)', 'UltraSecureOwnerSecret!2026')
            ->expectsQuestion('Confirm Password', 'UltraSecureOwnerSecret!2026')
            ->expectsOutputToContain('OWNER account created successfully.')
            ->assertSuccessful();

        $user = AdminUser::where('email', 'owner@callmeyoghurt.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('Main Callme Owner', $user->name);
        $this->assertEquals('owner@callmeyoghurt.com', $user->email);
        $this->assertEquals(AdminRole::OWNER, $user->role);
        $this->assertEquals(AdminStatus::ACTIVE, $user->status);
        $this->assertTrue($user->verifyPassword('UltraSecureOwnerSecret!2026'));
        $this->assertFalse($user->verifyPassword('WrongPassword'));

        // Verify audit log
        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $user->id,
            'action' => 'ACCOUNT_CREATED',
        ]);
    }

    /**
     * Test 2: Non-interactive creation using options succeeds.
     */
    public function test_can_create_owner_non_interactively_with_options(): void
    {
        $this->artisan('callme:create-owner', [
            '--name' => 'Automated Deployer',
            '--email' => 'cli_owner@callmeyoghurt.com',
            '--password' => 'DeployerPassPhrase!123',
        ])
            ->expectsOutputToContain('OWNER account created successfully.')
            ->assertSuccessful();

        $user = AdminUser::where('email', 'cli_owner@callmeyoghurt.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('Automated Deployer', $user->name);
        $this->assertEquals(AdminRole::OWNER, $user->role);
        $this->assertTrue($user->verifyPassword('DeployerPassPhrase!123'));
    }

    /**
     * Test 3: Rejects duplicate email (case-insensitive).
     */
    public function test_rejects_duplicate_email(): void
    {
        // First creation
        $this->artisan('callme:create-owner', [
            '--name' => 'First Owner',
            '--email' => 'owner@callmeyoghurt.com',
            '--password' => 'FirstPassword!123',
        ])->assertSuccessful();

        // Second creation with same email in uppercase
        $this->artisan('callme:create-owner', [
            '--name' => 'Duplicate Owner',
            '--email' => 'OWNER@CALLMEYOGHURT.COM',
            '--password' => 'SecondPassword!456',
        ])
            ->expectsOutputToContain("already exists")
            ->assertFailed();
    }

    /**
     * Test 4: Rejects invalid email address.
     */
    public function test_rejects_invalid_email_format(): void
    {
        $this->artisan('callme:create-owner', [
            '--name' => 'Invalid Email Owner',
            '--email' => 'not-an-email',
            '--password' => 'ValidPassword!123',
        ])
            ->expectsOutputToContain("not a valid email address")
            ->assertFailed();
    }

    /**
     * Test 5: Rejects password shorter than 8 characters.
     */
    public function test_rejects_short_password(): void
    {
        $this->artisan('callme:create-owner', [
            '--name' => 'Short Pass Owner',
            '--email' => 'short@callmeyoghurt.com',
            '--password' => 'short',
        ])
            ->expectsOutputToContain("Password must be at least 8 characters")
            ->assertFailed();
    }

    /**
     * Test 6: Rejects mismatched confirmation in interactive mode.
     */
    public function test_rejects_mismatched_confirmation(): void
    {
        $this->artisan('callme:create-owner')
            ->expectsQuestion('Enter Owner Full Name', 'Owner Mismatch')
            ->expectsQuestion('Enter Owner Email Address', 'mismatch@callmeyoghurt.com')
            ->expectsQuestion('Enter Password (minimum 8 characters)', 'PasswordOne!123')
            ->expectsQuestion('Confirm Password', 'PasswordTwo!456')
            ->expectsOutputToContain("Password and password confirmation do not match")
            ->assertFailed();

        $this->assertDatabaseMissing('admin_users', [
            'email' => 'mismatch@callmeyoghurt.com',
        ]);
    }

    /**
     * Test 7: Newly created OWNER account can authenticate via API and receive session cookie.
     */
    public function test_created_owner_can_login_and_logout_via_api(): void
    {
        $this->artisan('callme:create-owner', [
            '--name' => 'Login Test Owner',
            '--email' => 'owner@callmeyoghurt.com',
            '--password' => 'SuperSecretOwnerLogin!123',
        ])->assertSuccessful();

        // 1. Login via POST /api/admin/login
        $loginResponse = $this->postJson('/api/admin/login', [
            'email' => 'owner@callmeyoghurt.com',
            'password' => 'SuperSecretOwnerLogin!123',
        ]);

        $loginResponse->assertStatus(200);
        $loginResponse->assertJsonStructure([
            'user' => ['id', 'name', 'email', 'role'],
            'session_created',
        ]);
        $loginResponse->assertJson([
            'user' => [
                'name' => 'Login Test Owner',
                'email' => 'owner@callmeyoghurt.com',
                'role' => 'OWNER',
            ],
            'session_created' => true,
        ]);
        $loginResponse->assertCookie('callme_admin_session');

        // Extract cookie (autoDecrypt = false since token uses custom HMAC signature matching Next.js BFF)
        $cookie = $loginResponse->getCookie('callme_admin_session', false);
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $token = $cookie->getValue();

        // 2. Logout via POST /api/admin/logout
        $logoutResponse = $this->withHeader('Cookie', 'callme_admin_session=' . $token)
            ->postJson('/api/admin/logout');

        $logoutResponse->assertStatus(200);
        $logoutResponse->assertJson([
            'message' => 'Logged out successfully',
        ]);
        $logoutResponse->assertCookieExpired('callme_admin_session');
    }

    /**
     * Test 8: AdminUserSeeder skips gracefully when environment variables are omitted.
     */
    public function test_admin_user_seeder_skips_when_env_vars_missing(): void
    {
        putenv('INITIAL_OWNER_EMAIL');
        putenv('INITIAL_OWNER_PASSWORD');

        $this->seed(AdminUserSeeder::class);

        $this->assertEquals(0, AdminUser::count());
    }

    /**
     * Test 9: AdminUserSeeder provisions OWNER when environment variables are provided.
     */
    public function test_admin_user_seeder_provisions_owner_when_env_vars_present(): void
    {
        putenv('INITIAL_OWNER_NAME=Seeded Enterprise Owner');
        putenv('INITIAL_OWNER_EMAIL=seeder_owner@callmeyoghurt.com');
        putenv('INITIAL_OWNER_PASSWORD=SeededOwnerPassword!2026');

        $this->seed(AdminUserSeeder::class);

        $user = AdminUser::where('email', 'seeder_owner@callmeyoghurt.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('Seeded Enterprise Owner', $user->name);
        $this->assertEquals(AdminRole::OWNER, $user->role);
        $this->assertTrue($user->verifyPassword('SeededOwnerPassword!2026'));

        // Test idempotency: re-running seeder does not create duplicates or fail
        $this->seed(AdminUserSeeder::class);
        $this->assertEquals(1, AdminUser::where('email', 'seeder_owner@callmeyoghurt.com')->count());

        // Cleanup environment
        putenv('INITIAL_OWNER_NAME');
        putenv('INITIAL_OWNER_EMAIL');
        putenv('INITIAL_OWNER_PASSWORD');
    }
}
