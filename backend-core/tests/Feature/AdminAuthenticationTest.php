<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use App\Domain\Admin\Services\AdminAuthenticationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private AdminAuthenticationService $authService;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('admin_login:owner@callmeyoghurt.com|127.0.0.1');
        RateLimiter::clear('admin_login:admin@callmeyoghurt.com|127.0.0.1');
        RateLimiter::clear('admin_login:locked@callmeyoghurt.com|127.0.0.1');
        RateLimiter::clear('admin_login:leakcheck@callmeyoghurt.com|127.0.0.1');
        $this->authService = app(AdminAuthenticationService::class);
    }

    private function createAdmin(
        string $email,
        string $password,
        AdminRole $role = AdminRole::ADMIN,
        AdminStatus $status = AdminStatus::ACTIVE
    ): AdminUser {
        $user = new AdminUser();
        $user->name = 'Test ' . $role->value;
        $user->email = $email;
        $user->setPassword($password);
        $user->role = $role;
        $user->status = $status;
        $user->save();

        return $user;
    }

    /**
     * Test 1: Active OWNER login succeeds.
     */
    public function test_active_owner_login_succeeds(): void
    {
        $this->createAdmin('owner@callmeyoghurt.com', 'SuperSecretOwnerPassword!123', AdminRole::OWNER);

        $response = $this->postJson('/api/admin/login', [
            'email' => 'owner@callmeyoghurt.com',
            'password' => 'SuperSecretOwnerPassword!123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'user' => ['id', 'name', 'email', 'role'],
            'session_created',
        ]);

        $data = $response->json();
        $this->assertEquals('OWNER', $data['user']['role']);
        $this->assertEquals('owner@callmeyoghurt.com', $data['user']['email']);
        $this->assertTrue($data['session_created']);

        $response->assertCookie('callme_admin_session');
    }

    /**
     * Test 2: Active ADMIN login succeeds.
     */
    public function test_active_admin_login_succeeds(): void
    {
        $this->createAdmin('admin@callmeyoghurt.com', 'OpsAdminPassword!456', AdminRole::ADMIN);

        $response = $this->postJson('/api/admin/login', [
            'email' => 'admin@callmeyoghurt.com',
            'password' => 'OpsAdminPassword!456',
        ]);

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertEquals('ADMIN', $data['user']['role']);
        $this->assertEquals('admin@callmeyoghurt.com', $data['user']['email']);
        $this->assertTrue($data['session_created']);

        $response->assertCookie('callme_admin_session');
    }

    /**
     * Test 3: Wrong password rejected.
     */
    public function test_wrong_password_rejected(): void
    {
        $user = $this->createAdmin('admin@callmeyoghurt.com', 'CorrectPassword!123');

        $response = $this->postJson('/api/admin/login', [
            'email' => 'admin@callmeyoghurt.com',
            'password' => 'WrongPassword!999',
        ]);

        $response->assertStatus(401);
        $response->assertExactJson([
            'error' => 'Invalid credentials',
        ]);

        $user->refresh();
        $this->assertEquals(1, $user->failed_login_attempts);
        $this->assertNull($user->locked_until);
    }

    /**
     * Test 4: Disabled account rejected.
     */
    public function test_disabled_account_rejected(): void
    {
        $this->createAdmin('disabled@callmeyoghurt.com', 'ValidPassword!123', AdminRole::ADMIN, AdminStatus::DISABLED);

        $response = $this->postJson('/api/admin/login', [
            'email' => 'disabled@callmeyoghurt.com',
            'password' => 'ValidPassword!123',
        ]);

        $response->assertStatus(401);
        $response->assertExactJson([
            'error' => 'Invalid credentials',
        ]);
    }

    /**
     * Test 5: Repeated failures trigger lock.
     */
    public function test_repeated_failures_trigger_lock(): void
    {
        $user = $this->createAdmin('locked@callmeyoghurt.com', 'CorrectPassword!123');

        for ($i = 1; $i <= 4; $i++) {
            $response = $this->postJson('/api/admin/login', [
                'email' => 'locked@callmeyoghurt.com',
                'password' => 'WrongGuess!' . $i,
            ]);
            $response->assertStatus(401);
        }

        $user->refresh();
        $this->assertEquals(4, $user->failed_login_attempts);
        $this->assertFalse($user->isLocked());

        // 5th failed attempt triggers temporary lock and rate limit
        $response = $this->postJson('/api/admin/login', [
            'email' => 'locked@callmeyoghurt.com',
            'password' => 'WrongGuess!5',
        ]);
        $response->assertStatus(401);

        $user->refresh();
        $this->assertEquals(5, $user->failed_login_attempts);
        $this->assertTrue($user->isLocked());
        $this->assertNotNull($user->locked_until);

        // Account lock audit was recorded
        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $user->id,
            'action' => 'ACCOUNT_LOCKED',
        ]);

        // 6th consecutive attempt triggers rate limiter (429)
        $rateLimitedResponse = $this->postJson('/api/admin/login', [
            'email' => 'locked@callmeyoghurt.com',
            'password' => 'CorrectPassword!123',
        ]);
        $rateLimitedResponse->assertStatus(429);

        // Clearing IP throttle (simulating new IP or window reset) still fails closed because account itself is locked
        RateLimiter::clear('admin_login:locked@callmeyoghurt.com|127.0.0.1');
        $lockedResponse = $this->postJson('/api/admin/login', [
            'email' => 'locked@callmeyoghurt.com',
            'password' => 'CorrectPassword!123',
        ]);
        $lockedResponse->assertStatus(401);
        $lockedResponse->assertExactJson([
            'error' => 'Invalid credentials',
        ]);
    }

    /**
     * Test 6: Successful login creates audit log.
     */
    public function test_successful_login_creates_audit_log(): void
    {
        $user = $this->createAdmin('audit@callmeyoghurt.com', 'AuditPassword!123', AdminRole::OWNER);

        $this->postJson('/api/admin/login', [
            'email' => 'audit@callmeyoghurt.com',
            'password' => 'AuditPassword!123',
        ]);

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $user->id,
            'action' => 'LOGIN_SUCCESS',
        ]);

        $log = AdminAuditLog::where('admin_user_id', $user->id)->first();
        $this->assertNotNull($log);
        $this->assertNull($log->metadata); // Passwords or tokens are never stored
    }

    /**
     * Test 7: Password hash never appears in API response.
     */
    public function test_password_hash_never_appears_in_api_response(): void
    {
        $this->createAdmin('leakcheck@callmeyoghurt.com', 'CheckPassword!123');

        $successResponse = $this->postJson('/api/admin/login', [
            'email' => 'leakcheck@callmeyoghurt.com',
            'password' => 'CheckPassword!123',
        ]);

        $rawSuccessContent = (string) $successResponse->getContent();
        $this->assertStringNotContainsString('password', $rawSuccessContent);
        $this->assertStringNotContainsString('password_hash', $rawSuccessContent);
        $this->assertStringNotContainsString('argon2id', $rawSuccessContent);

        RateLimiter::clear('admin_login:leakcheck@callmeyoghurt.com|127.0.0.1');

        $failResponse = $this->postJson('/api/admin/login', [
            'email' => 'leakcheck@callmeyoghurt.com',
            'password' => 'WrongPassword',
        ]);

        $rawFailContent = (string) $failResponse->getContent();
        $this->assertStringNotContainsString('password_hash', $rawFailContent);
        $this->assertStringNotContainsString('argon2id', $rawFailContent);
    }

    /**
     * Test 8: Logout clears cookie and creates audit log.
     */
    public function test_logout_clears_cookie_and_creates_audit_log(): void
    {
        $user = $this->createAdmin('logout@callmeyoghurt.com', 'LogoutPassword!123');
        $token = $this->authService->issueSessionToken($user);

        $response = $this->withHeader('Cookie', 'callme_admin_session=' . $token)
            ->postJson('/api/admin/logout');

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Logged out successfully',
        ]);

        // Cookie cleared (expired in past)
        $response->assertCookieExpired('callme_admin_session');

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_user_id' => $user->id,
            'action' => 'LOGOUT',
        ]);
    }
}
