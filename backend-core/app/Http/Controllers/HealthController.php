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
     * Readiness check confirming PostgreSQL database and Redis connectivity.
     */
    public function ready(): JsonResponse
    {
        try {
            DB::connection()->getPdo()->query('SELECT 1');

            $payload = [
                'status' => 'ready',
                'service' => 'erp-core',
                'database' => 'connected',
            ];

            // Verify distributed Redis ephemeral storage when configured or in production
            $redisRequired = config('cache.default') === 'redis'
                || config('shipping.cache_store') === 'redis'
                || (app()->environment('production') && (bool) env('REDIS_HOST'));

            if ($redisRequired) {
                try {
                    \Illuminate\Support\Facades\Redis::connection()->ping();
                    $payload['redis'] = 'connected';
                } catch (Throwable) {
                    return response()->json([
                        'status' => 'unavailable',
                        'service' => 'erp-core',
                        'database' => 'connected',
                        'redis' => 'disconnected',
                    ], 503);
                }
            }

            return response()->json($payload, 200);
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
