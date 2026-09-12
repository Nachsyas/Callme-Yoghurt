<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController
{
    /**
     * Liveness check confirming the application process boots.
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'erp-core',
        ], 200);
    }

    /**
     * Readiness check confirming PostgreSQL database connectivity.
     */
    public function ready(): JsonResponse
    {
        try {
            DB::connection()->getPdo()->query('SELECT 1');

            return response()->json([
                'status' => 'ready',
                'service' => 'erp-core',
                'database' => 'connected',
            ], 200);
        } catch (Throwable) {
            // Strictly sanitized: never leak DSN, credentials, or stack traces
            return response()->json([
                'status' => 'unavailable',
                'service' => 'erp-core',
                'database' => 'disconnected',
            ], 503);
        }
    }

    /**
     * Authenticated internal health probe to verify service authentication middleware.
     */
    public function internalHealth(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'erp-core',
            'channel' => 'internal',
        ], 200);
    }
}
