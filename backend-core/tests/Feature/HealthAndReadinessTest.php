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
}
