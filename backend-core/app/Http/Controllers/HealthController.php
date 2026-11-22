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
                || (app()->environment('production') && ((bool) env('REDIS_HOST') || (bool) env('REDIS_URL')));

            if ($redisRequired) {
                try {
                    $connectionsToCheck = [];

                    $shippingStore = config('shipping.cache_store');
                    if ($shippingStore) {
                        $driver = config("cache.stores.{$shippingStore}.driver", $shippingStore);
                        if ($driver === 'redis') {
                            $connectionsToCheck[] = config("cache.stores.{$shippingStore}.connection", 'cache');
                        }
                    }

                    $cacheStore = config('cache.default');
                    if ($cacheStore) {
                        $driver = config("cache.stores.{$cacheStore}.driver", $cacheStore);
                        if ($driver === 'redis') {
                            $connectionsToCheck[] = config("cache.stores.{$cacheStore}.connection", 'cache');
                        }
                    }

                    if (empty($connectionsToCheck)) {
                        $connectionsToCheck[] = config('cache.stores.redis.connection', 'cache');
                    }

                    $connectionsToCheck = array_unique($connectionsToCheck);

                    foreach ($connectionsToCheck as $conn) {
                        \Illuminate\Support\Facades\Redis::connection($conn)->ping();
                    }

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
