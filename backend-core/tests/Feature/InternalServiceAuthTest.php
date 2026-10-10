<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class InternalServiceAuthTest extends TestCase
{
    private string $validToken = 'test-erp-service-token-secret-64ch';

    /**
     * Proves internal service routes reject requests missing an Authorization bearer token.
     */
    public function test_internal_service_route_rejects_missing_bearer_token(): void
    {
        $response = $this->getJson('/api/internal/health');

        $response->assertStatus(401);
        $response->assertJson([
            'error' => 'Unauthorized: missing bearer token',
        ]);
    }

    /**
     * Proves internal service routes reject invalid bearer tokens.
     */
    public function test_internal_service_route_rejects_invalid_bearer_token(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer forged-or-invalid-token',
        ])->getJson('/api/internal/health');

        $response->assertStatus(401);
        $response->assertJson([
            'error' => 'Unauthorized: invalid service token',
        ]);
    }

    /**
     * Proves internal service routes accept valid bearer tokens with HTTP 200.
     */
    public function test_internal_service_route_accepts_valid_service_token(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/health');

        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'ok',
            'service' => 'erp-core',
            'channel' => 'internal',
        ]);
    }

    /**
     * Proves internal service routes fail closed with HTTP 503 when the server secret is unconfigured.
     */
    public function test_internal_service_route_fails_closed_when_service_token_is_unconfigured(): void
    {
        config(['services.internal.service_token' => null]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/health');

        $response->assertStatus(503);
        $response->assertJson([
            'error' => 'Internal service authentication is unconfigured',
        ]);
    }
}
