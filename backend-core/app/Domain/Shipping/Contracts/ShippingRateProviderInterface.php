<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Contracts;

interface ShippingRateProviderInterface
{
    /**
     * Fetch rate quotes from the upstream provider.
     *
     * @param array<string, mixed> $origin
     * @param array<string, mixed> $destination
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>> Raw rate objects
     */
    public function getRates(array $origin, array $destination, array $items): array;
}
