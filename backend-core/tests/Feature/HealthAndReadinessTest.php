<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HealthAndReadinessTest extends TestCase
{
    /**
     * Proves the Laravel application boots successfully.
     */
    public function test_application_boots_successfully(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertJson([
            'service' => 'Callme Yoghurt ERP Core',
            'status' => 'operational',
        ]);
    }

    /**
     * Proves /api/health confirms process boot with minimal sanitized response.
     */
    public function test_health_endpoint_returns_sanitized_status(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);
        $response->assertExactJson([
            'status' => 'ok',
            'service' => 'erp-core',
        ]);

        // Never leak environment, framework version, or debug info
        $data = $response->json();
        $this->assertArrayNotHasKey('env', $data);
        $this->assertArrayNotHasKey('debug', $data);
        $this->assertArrayNotHasKey('version', $data);
    }

    /**
     * Proves /api/ready succeeds with HTTP 200 when database connectivity is established.
     */
    public function test_ready_endpoint_succeeds_when_database_is_connected(): void
    {
        $response = $this->getJson('/api/ready');

        $response->assertStatus(200);
        $response->assertExactJson([
            'status' => 'ready',
            'service' => 'erp-core',
            'database' => 'connected',
        ]);
    }

    /**
     * Proves /api/ready fails safely with HTTP 503 without leaking DSN, credentials, or stack traces when DB is disconnected.
     */
    public function test_ready_endpoint_fails_safely_when_database_is_unavailable(): void
    {
        // Point DB connection to a non-existent port to simulate network/db outage
        config(['database.connections.pgsql.port' => '54329']);
        DB::purge('pgsql');

        $response = $this->getJson('/api/ready');

        $response->assertStatus(503);
        $response->assertExactJson([
            'status' => 'unavailable',
            'service' => 'erp-core',
            'database' => 'disconnected',
        ]);

        $content = $response->getContent();
        $this->assertStringNotContainsString('password', (string) $content);
        $this->assertStringNotContainsString('callme_dev_user', (string) $content);
        $this->assertStringNotContainsString('SQLSTATE', (string) $content);
    }

    /**
     * Proves /api/ready fails safely with HTTP 503 without leaking details when Redis is required but unreachable.
     */
    public function test_ready_endpoint_fails_safely_when_redis_is_required_but_disconnected(): void
    {
        // Configure Redis as mandatory cache store pointing to unavailable port
        config([
            'cache.default' => 'redis',
            'database.redis.default.port' => '63799',
            'database.redis.default.host' => '127.0.0.1',
            'database.redis.cache.port' => '63799',
            'database.redis.cache.host' => '127.0.0.1',
        ]);

        $response = $this->getJson('/api/ready');

        $response->assertStatus(503);
        $response->assertExactJson([
            'status' => 'unavailable',
            'service' => 'erp-core',
            'database' => 'connected',
            'redis' => 'disconnected',
        ]);

        $content = $response->getContent();
        $this->assertStringNotContainsString('password', (string) $content);
        $this->assertStringNotContainsString('Connection refused', (string) $content);
    }

    /**
     * Proves /api/ready verifies the exact Redis connection configured for SHIPPING_CACHE_STORE.
     */
    public function test_ready_endpoint_fails_when_shipping_quote_redis_connection_is_disconnected(): void
    {
        config([
            'cache.default' => 'file',
            'shipping.cache_store' => 'redis',
            'database.redis.cache.port' => '63799',
            'database.redis.cache.host' => '127.0.0.1',
        ]);

        $response = $this->getJson('/api/ready');

        $response->assertStatus(503);
        $response->assertExactJson([
            'status' => 'unavailable',
            'service' => 'erp-core',
            'database' => 'connected',
            'redis' => 'disconnected',
        ]);
    }

    /**
     * Proves /api/internal/health responds with 200 when service authentication succeeds.
     */
    public function test_internal_health_endpoint(): void
    {
        $token = 'test-erp-service-token-secret-64ch';
        config(['services.internal.service_token' => $token]);

        $response = $this->withToken($token)->getJson('/api/internal/health');

        $response->assertStatus(200);
        $response->assertExactJson([
            'status' => 'ok',
            'service' => 'erp-core',
            'channel' => 'internal',
        ]);
    }
}
