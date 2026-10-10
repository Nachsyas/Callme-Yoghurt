<?php

declare(strict_types=1);

namespace App\Domain\Admin\Services;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use Illuminate\Support\Facades\Hash;

class AdminAuthenticationService
{
    private const DEV_FALLBACK_SECRET = 'dev_insecure_admin_session_secret_32chars_min';

    // Standard dummy hash used to neutralize timing attacks when email does not exist
    private const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$VHNOcnBBSnBwT04zcUhSQg$dDbXg58fcRX6u1iMJ10s8pPTNsEhItgaHa9JRxMa0NA';

    /**
     * Authenticate an admin user by email and password.
     *
     * @return array{success: bool, user?: array{id: string, name: string, email: string, role: string}, token?: string, session_created?: bool, error?: string}
     */
    public function login(
        string $email,
        string $password,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): array {
        $normalizedEmail = mb_strtolower(trim($email));

        if ($normalizedEmail === '' || trim($password) === '') {
            return [
                'success' => false,
                'error' => 'Invalid credentials',
            ];
        }

        $user = AdminUser::where('email', $normalizedEmail)->first();

        // 1. If user does not exist, run dummy verification to maintain constant-time execution
        if (! $user) {
            Hash::check($password, self::DUMMY_HASH);
            AdminAuditLog::record('LOGIN_FAILED', null, ['email' => $normalizedEmail, 'reason' => 'user_not_found'], $ipAddress, $userAgent);

            return [
                'success' => false,
                'error' => 'Invalid credentials',
            ];
        }

        // 2. Account lock check
        if ($user->isLocked()) {
            AdminAuditLog::record('LOGIN_FAILED', $user->id, ['reason' => 'account_locked'], $ipAddress, $userAgent);

            return [
                'success' => false,
                'error' => 'Invalid credentials',
            ];
        }

        // 3. Status check: DISABLED accounts are rejected
        if ($user->status !== AdminStatus::ACTIVE) {
            // Run password check to avoid timing leakage
            $user->verifyPassword($password);
            AdminAuditLog::record('LOGIN_FAILED', $user->id, ['reason' => 'account_disabled'], $ipAddress, $userAgent);

            return [
                'success' => false,
                'error' => 'Invalid credentials',
            ];
        }

        // 4. Password verification
        if (! $user->verifyPassword($password)) {
            $user->incrementFailedAttempts(5, 15);

            if ($user->isLocked()) {
                AdminAuditLog::record('ACCOUNT_LOCKED', $user->id, ['failed_attempts' => $user->failed_login_attempts], $ipAddress, $userAgent);
            }

            AdminAuditLog::record('LOGIN_FAILED', $user->id, ['reason' => 'invalid_password'], $ipAddress, $userAgent);

            return [
                'success' => false,
                'error' => 'Invalid credentials',
            ];
        }

        // 5. Successful login
        $user->recordSuccessfulLogin();
        AdminAuditLog::record('LOGIN_SUCCESS', $user->id, null, $ipAddress, $userAgent);

        $token = $this->issueSessionToken($user);

        return [
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
            ],
            'token' => $token,
            'session_created' => true,
        ];
    }

    /**
     * Issue an HMAC-SHA256 session token conforming exactly to frontend admin-session.ts.
     */
    public function issueSessionToken(AdminUser $user, int $ttlSeconds = 86400): string
    {
        $secret = $this->getAdminSessionSecret();
        $now = time();

        $payload = [
            'user' => [
                'id' => $user->id,
                'username' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
            ],
            'issuedAt' => $now,
            'expiresAt' => $now + $ttlSeconds,
        ];

        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $secret, true);
        $encodedSignature = $this->base64UrlEncode($signature);

        return "{$encodedPayload}.{$encodedSignature}";
    }

    /**
     * Decode and verify a session token if present.
     */
    public function verifySessionToken(string $token): ?array
    {
        if (trim($token) === '') {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $signature] = $parts;

        $secret = $this->getAdminSessionSecret();
        $expectedSignature = $this->base64UrlEncode(hash_hmac('sha256', $encodedPayload, $secret, true));

        if (! hash_equals($expectedSignature, $signature)) {
            return null;
        }

        try {
            $data = json_decode($this->base64UrlDecode($encodedPayload), true, 512, JSON_THROW_ON_ERROR);

            if (! isset($data['expiresAt']) || $data['expiresAt'] <= time()) {
                return null;
            }

            return $data;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Record logout audit log.
     */
    public function logout(?string $token = null, ?string $ipAddress = null, ?string $userAgent = null): void
    {
        $adminUserId = null;
        if ($token) {
            $session = $this->verifySessionToken($token);
            if ($session && isset($session['user']['id'])) {
                $adminUserId = (string) $session['user']['id'];
            }
        }

        AdminAuditLog::record('LOGOUT', $adminUserId, null, $ipAddress, $userAgent);
    }

    public function getAdminSessionSecret(): string
    {
        $envSecret = config('services.admin.session_secret') ?? env('ADMIN_SESSION_SECRET');
        if (is_string($envSecret) && strlen(trim($envSecret)) >= 16) {
            return trim($envSecret);
        }

        if (app()->environment('production')) {
            throw new \RuntimeException('SECURITY CRITICAL: ADMIN_SESSION_SECRET is unconfigured in production. Failing closed.');
        }

        return self::DEV_FALLBACK_SECRET;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($data, '-_', '+/'));
    }
}
