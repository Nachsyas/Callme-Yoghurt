<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Security\Services\ProductionConfigValidator;
use Tests\TestCase;

class ProductionConfigValidationTest extends TestCase
{
    /**
     * Proves production configuration validator catches missing or invalid critical secrets.
     */
    public function test_validator_fails_when_critical_secrets_are_missing(): void
    {
        $validator = new ProductionConfigValidator();

        // In strict mode with empty secrets
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
     * Proves production configuration validator rejects APP_DEBUG=true in production.
     */
    public function test_validator_rejects_debug_mode_in_production(): void
    {
        $validator = new ProductionConfigValidator();

        config(['app.debug' => true]);

        $result = $validator->validate(strict: true);

        $this->assertFalse($result['passed']);
        $this->assertArrayHasKey('APP_DEBUG', $result['errors']);
    }

    /**
     * Proves production configuration validator passes when all production secrets and configurations are valid.
     */
    public function test_validator_passes_when_all_secrets_and_configurations_are_valid(): void
    {
        $validator = new ProductionConfigValidator();

        config([
            'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
            'app.debug' => false,
            'services.internal.service_token' => str_repeat('b', 32),
            'crm.pii_blind_index_key' => str_repeat('c', 32),
            'checkout.fingerprint_key' => str_repeat('d', 32),
            'services.admin.session_secret' => str_repeat('e', 32),
            'database.default' => 'pgsql',
            'database.connections.pgsql.password' => 'secure-db-password',
            'cache.default' => 'redis',
            'shipping.cache_store' => 'redis',
            'hashing.driver' => 'argon2id',
        ]);

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
        config([
            'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
            'app.debug' => false,
            'services.internal.service_token' => str_repeat('b', 32),
            'crm.pii_blind_index_key' => str_repeat('c', 32),
            'checkout.fingerprint_key' => str_repeat('d', 32),
            'services.admin.session_secret' => str_repeat('e', 32),
            'database.default' => 'pgsql',
            'database.connections.pgsql.password' => 'secure-db-password',
            'cache.default' => 'redis',
            'shipping.cache_store' => 'redis',
            'hashing.driver' => 'argon2id',
        ]);

        $this->artisan('callme:validate-production-config', ['--strict' => true])
            ->assertExitCode(0)
            ->expectsOutputToContain('All security-critical configuration checks PASSED');
    }

    /**
     * Proves artisan command callme:validate-production-config fails and NEVER leaks secret values in output.
     */
    public function test_artisan_validate_command_never_leaks_secrets(): void
    {
        $secretCandidate = 'SUPER_SECRET_VALUE_NEVER_PRINT_ME_IN_TERMINAL_12345';
        config([
            'services.internal.service_token' => $secretCandidate,
            'crm.pii_blind_index_key' => '', // Force failure
        ]);

        $this->artisan('callme:validate-production-config', ['--strict' => true])
            ->assertExitCode(1)
            ->doesntExpectOutput($secretCandidate);
    }
}
