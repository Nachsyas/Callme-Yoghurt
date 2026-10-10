<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidateInternalServiceToken
{
    /**
     * Handle an incoming internal service request.
     *
     * Invariants:
     * - Missing server configuration fails closed with HTTP 503 Service Unavailable.
     * - Missing bearer token returns HTTP 401 Unauthorized.
     * - Invalid bearer token returns HTTP 401 Unauthorized using timing-safe comparison.
     * - Tokens are never exposed in error responses or logs.
     * - No hardcoded fallback secret is accepted.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $configuredToken = config('services.internal.service_token');

        // Missing server configuration fails closed
        if (!is_string($configuredToken) || $configuredToken === '') {
            return response()->json([
                'error' => 'Internal service authentication is unconfigured',
            ], 503);
        }

        $bearerToken = $request->bearerToken();

        // Missing bearer token
        if (!is_string($bearerToken) || $bearerToken === '') {
            return response()->json([
                'error' => 'Unauthorized: missing bearer token',
            ], 401);
        }

        // Timing-safe comparison to prevent side-channel timing attacks
        if (!hash_equals($configuredToken, $bearerToken)) {
            return response()->json([
                'error' => 'Unauthorized: invalid service token',
            ], 401);
        }

        return $next($request);
    }
}
