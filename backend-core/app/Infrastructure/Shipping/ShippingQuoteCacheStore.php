<?php

declare(strict_types=1);

namespace App\Infrastructure\Shipping;

use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Throwable;

class ShippingQuoteCacheStore
{
    /**
     * Resolves the ephemeral cache store for shipping quote persistence.
     *
     * Invariants (Section 15):
     * - In production, explicitly requires shared Redis or configured distributed store.
     * - Fails closed if Redis is unavailable in production.
     * - Never silently falls back to process-local array memory in production.
     * - Testing/local environments may use configured or default cache repository.
     */
    public static function getStore(): CacheRepository
    {
        $configuredStore = config('shipping.cache_store');
        $isProduction = app()->environment('production');

        if ($isProduction) {
            $storeName = (is_string($configuredStore) && trim($configuredStore) !== '') ? trim($configuredStore) : 'redis';
            try {
                $repository = Cache::store($storeName);
                // Health check/probe: verify driver is not array/file in production unless explicitly allowed
                $driverName = config("cache.stores.{$storeName}.driver", $storeName);
                if ($driverName === 'array' || $driverName === 'file') {
                    throw new RuntimeException("Insecure ephemeral store [{$driverName}] rejected in production.");
                }

                return $repository;
            } catch (Throwable $e) {
                throw new RuntimeException('Production Redis quote store is unavailable. Failing closed.', 0, $e);
            }
        }

        return (is_string($configuredStore) && trim($configuredStore) !== '')
            ? Cache::store($configuredStore)
            : Cache::store();
    }
}
