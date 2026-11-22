<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Security\Services\ProductionConfigValidator;
use Tests\TestCase;

class ProductionConfigValidationTest extends TestCase
{
    /**
     * Helper to provide baseline valid production configuration.
     *
     * @return array<string, mixed>
     */
    private function validConfig(): array
    {
        return [
            'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
            'app.debug' => false,
            'services.internal.service_token' => str_repeat('b', 32),
            'crm.pii_blind_index_key' => str_repeat('c', 32),
            'checkout.fingerprint_key' => str_repeat('d', 32),
            'services.admin.session_secret' => str_repeat('e', 32),
            'database.default' => 'pgsql',
            'database.connections.pgsql.url' => null,
            'database.connections.pgsql.host' => '127.0.0.1',
            'database.connections.pgsql.database' => 'callme_prod',
            'database.connections.pgsql.username' => 'callme_user',
            'database.connections.pgsql.password' => 'secure-db-password',
            'database.redis.default.url' => null,
            'database.redis.default.host' => '127.0.0.1',
            'cache.default' => 'redis',
            'shipping.cache_store' => 'redis',
            'hashing.driver' => 'argon2id',
        ];
    }

    /**
     * Proves production configuration validator catches missing or invalid critical secrets.
     */
    public function test_validator_fails_when_critical_secrets_are_missing(): void
    {
        $validator = new ProductionConfigValidator();

        config([
            'services.internal.service_token' => '',
            'crm.pii_blind_index_key' => '',
            'checkout.fingerprint_key' => '',
            'services.admin.session_secret' => '',
        ]);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertArrayHasKey('ERP_SERVICE_TOKEN', $result['errors']);
        $this->assertArrayHasKey('CRM_PII_BLIND_INDEX_KEY', $result['errors']);
        $this->assertArrayHasKey('CHECKOUT_FINGERPRINT_KEY', $result['errors']);
        $this->assertArrayHasKey('ADMIN_SESSION_SECRET', $result['errors']);
    }

    /**
     * Proves production configuration validator catches insufficient secret length.
     */
    public function test_validator_fails_when_secrets_are_too_short(): void
    {
        $validator = new ProductionConfigValidator();

        config([
            'app.key' => 'short-key',
            'services.internal.service_token' => 'short-token',
            'crm.pii_blind_index_key' => 'short-pii',
            'checkout.fingerprint_key' => 'short-fp',
            'services.admin.session_secret' => 'short-adm',
        ]);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertEquals('INVALID_LENGTH', $result['audited']['ERP_SERVICE_TOKEN']);
        $this->assertEquals('INVALID_LENGTH', $result['audited']['CRM_PII_BLIND_INDEX_KEY']);
        $this->assertEquals('INVALID_LENGTH', $result['audited']['CHECKOUT_FINGERPRINT_KEY']);
        $this->assertEquals('INVALID_LENGTH', $result['audited']['ADMIN_SESSION_SECRET']);
    }

    /**
     * Proves APP_KEY validation correctly evaluates:
     * - valid 32-byte base64 key
     * - invalid base64
     * - base64:x
     * - empty key
     * - wrong decoded length
     * - non-base64 32-byte raw key
     * - non-base64 wrong length
     */
    public function test_validator_app_key_strict_cryptographic_contract(): void
    {
        $validator = new ProductionConfigValidator();
        $base = $this->validConfig();

        // 1. Valid 32-byte base64 key
        config(array_merge($base, [
            'app.key' => 'base64:' . base64_encode(random_bytes(32)),
        ]));
        $res = $validator->validate(strict: true);
        $this->assertTrue($res['passed'], 'Valid 32-byte base64 key must pass');
        $this->assertStringContainsString('OK', $res['audited']['APP_KEY']);

        // 2. Empty key
        config(array_merge($base, ['app.key' => '']));
        $res = $validator->validate(strict: true);
        $this->assertFalse($res['passed']);
        $this->assertEquals('MISSING', $res['audited']['APP_KEY']);

        // 3. Invalid base64 characters
        config(array_merge($base, ['app.key' => 'base64:???not-valid-base64???']));
        $res = $validator->validate(strict: true);
        $this->assertFalse($res['passed']);
        $this->assertEquals('INVALID_BASE64', $res['audited']['APP_KEY']);

        // 4. base64:x (too short, not valid 32-byte decoded)
        config(array_merge($base, ['app.key' => 'base64:x']));
        $res = $validator->validate(strict: true);
        $this->assertFalse($res['passed']);

        // 5. Wrong decoded length (e.g. 16 bytes AES-128 instead of 32 bytes AES-256)
        config(array_merge($base, [
            'app.key' => 'base64:' . base64_encode(random_bytes(16)),
        ]));
        $res = $validator->validate(strict: true);
        $this->assertFalse($res['passed']);
        $this->assertEquals('WRONG_BYTE_LENGTH', $res['audited']['APP_KEY']);

        // 6. Non-base64 valid 32-byte raw key
        config(array_merge($base, [
            'app.key' => str_repeat('k', 32),
        ]));
        $res = $validator->validate(strict: true);
        $this->assertTrue($res['passed'], 'Raw 32-byte key is accepted');
        $this->assertEquals('OK (raw:32-bytes)', $res['audited']['APP_KEY']);

        // 7. Non-base64 wrong length (e.g. 16 raw bytes)
        config(array_merge($base, [
            'app.key' => str_repeat('k', 16),
        ]));
        $res = $validator->validate(strict: true);
        $this->assertFalse($res['passed']);
        $this->assertEquals('WRONG_BYTE_LENGTH', $res['audited']['APP_KEY']);
    }

    /**
     * Proves production configuration validator rejects APP_DEBUG=true in production.
     */
    public function test_validator_rejects_debug_mode_in_production(): void
    {
        $validator = new ProductionConfigValidator();
        config(array_merge($this->validConfig(), ['app.debug' => true]));

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertArrayHasKey('APP_DEBUG', $result['errors']);
    }

    /**
     * Proves DB_URL provider-neutral support (Section 6 & 13):
     * Accepts valid postgres:// or postgresql:// URL and does NOT require separate DB_PASSWORD.
     */
    public function test_validator_accepts_valid_db_url(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();
        $cfg['database.connections.pgsql.url'] = 'postgres://app_user:db_secret_pass@db.provider.internal:5432/callme_db';
        $cfg['database.connections.pgsql.password'] = ''; // Empty host password
        config($cfg);

        $result = $validator->validate(strict: true);

        $this->assertTrue($result['passed']);
        $this->assertEquals('OK (DB_URL configured)', $result['audited']['DB_CONFIG']);
    }

    /**
     * Proves malformed DB_URL is rejected.
     */
    public function test_validator_rejects_malformed_db_url(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();

        // Wrong scheme
        $cfg['database.connections.pgsql.url'] = 'mysql://app_user:pass@db.provider.internal:3306/db';
        config($cfg);
        $result = $validator->validate(strict: true);
        $this->assertFalse($result['passed']);
        $this->assertEquals('INVALID_DB_URL', $result['audited']['DB_CONFIG']);

        // Missing host
        $cfg['database.connections.pgsql.url'] = 'postgres:///callme_db';
        config($cfg);
        $result = $validator->validate(strict: true);
        $this->assertFalse($result['passed']);
        $this->assertEquals('INVALID_DB_URL', $result['audited']['DB_CONFIG']);
    }

    /**
     * Proves incomplete host-style DB configuration is rejected.
     */
    public function test_validator_rejects_incomplete_host_db_config(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();
        $cfg['database.connections.pgsql.url'] = null;
        $cfg['database.connections.pgsql.password'] = ''; // Missing password
        config($cfg);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertEquals('INCOMPLETE_HOST_CONFIG', $result['audited']['DB_CONFIG']);
    }

    /**
     * Proves REDIS_URL provider-neutral support (Section 9 & 13):
     * Accepts valid redis:// or rediss:// URL and does not require separate REDIS_PASSWORD.
     */
    public function test_validator_accepts_valid_redis_url(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();
        $cfg['database.redis.default.url'] = 'redis://:redis_secret_pass@redis.provider.internal:6379/0';
        $cfg['database.redis.default.host'] = '';
        config($cfg);

        $result = $validator->validate(strict: true);

        $this->assertTrue($result['passed']);
        $this->assertEquals('OK (REDIS_URL configured)', $result['audited']['REDIS_CONFIG']);

        // Also test rediss:// (TLS)
        $cfg['database.redis.default.url'] = 'rediss://user:secret@redis-tls.provider.internal:6380/0';
        config($cfg);
        $result = $validator->validate(strict: true);
        $this->assertTrue($result['passed']);
        $this->assertEquals('OK (REDIS_URL configured)', $result['audited']['REDIS_CONFIG']);
    }

    /**
     * Proves malformed REDIS_URL is rejected.
     */
    public function test_validator_rejects_malformed_redis_url(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();
        $cfg['database.redis.default.url'] = 'http://not-redis.example.com';
        $cfg['database.redis.default.host'] = '';
        config($cfg);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertEquals('INVALID_REDIS_URL', $result['audited']['REDIS_CONFIG']);
    }

    /**
     * Proves missing Redis configuration in production is rejected.
     */
    public function test_validator_rejects_missing_redis_config(): void
    {
        $validator = new ProductionConfigValidator();
        $cfg = $this->validConfig();
        $cfg['database.redis.default.url'] = null;
        $cfg['database.redis.default.host'] = '';
        config($cfg);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertEquals('MISSING', $result['audited']['REDIS_CONFIG']);
    }

    /**
     * Proves production configuration validator passes when all production secrets and configurations are valid.
     */
    public function test_validator_passes_when_all_secrets_and_configurations_are_valid(): void
    {
        $validator = new ProductionConfigValidator();
        config($this->validConfig());

        $result = $validator->validate(strict: true);

        $this->assertTrue($result['passed']);
        $this->assertEmpty($result['errors']);
        $this->assertEquals('OK', $result['audited']['ERP_SERVICE_TOKEN']);
        $this->assertEquals('OK', $result['audited']['CRM_PII_BLIND_INDEX_KEY']);
        $this->assertEquals('OK', $result['audited']['CHECKOUT_FINGERPRINT_KEY']);
        $this->assertEquals('OK', $result['audited']['ADMIN_SESSION_SECRET']);
    }

    /**
     * Proves artisan command callme:validate-production-config runs and returns exit code 0 when valid.
     */
    public function test_artisan_validate_command_succeeds_with_valid_config(): void
    {
        config($this->validConfig());

        $this->artisan('callme:validate-production-config', ['--strict' => true])
            ->assertExitCode(0)
            ->expectsOutputToContain('All security-critical configuration checks PASSED');
    }

    /**
     * Proves artisan command callme:validate-production-config fails and NEVER leaks secret values, DB_URL, or REDIS_URL credentials.
     */
    public function test_artisan_validate_command_never_leaks_secrets_or_urls(): void
    {
        $secretCandidate = 'SUPER_SECRET_VALUE_NEVER_PRINT_ME_IN_TERMINAL_12345';
        $dbUrlSecret = 'db_secret_pass_xyz123';
        $redisUrlSecret = 'redis_secret_pass_xyz987';

        config([
            'services.internal.service_token' => $secretCandidate,
            'crm.pii_blind_index_key' => '', // Force failure
            'database.connections.pgsql.url' => "postgres://user:{$dbUrlSecret}@db.internal:5432/callme",
            'database.redis.default.url' => "redis://:{$redisUrlSecret}@redis.internal:6379/0",
        ]);

        $this->artisan('callme:validate-production-config', ['--strict' => true])
            ->assertExitCode(1)
            ->doesntExpectOutput($secretCandidate)
            ->doesntExpectOutput($dbUrlSecret)
            ->doesntExpectOutput($redisUrlSecret);
    }
}
