<?php

declare(strict_types=1);

namespace App\Domain\Pricing\Services;

use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Pricing\Exceptions\VariantPriceUnavailableException;
use App\Domain\Pricing\Models\ProductVariantPrice;

class CurrentVariantPriceResolver
{
    /**
     * Resolve the authoritative current retail price for a product variant.
     *
     * Invariants:
     * - Variant must be active.
     * - Associated InventoryItem must be active.
     * - Active price record in the requested currency (default 'IDR') must exist.
     * - Obtains a row lock via lockForUpdate() when lockRow is true (used inside checkout transaction).
     * - Returns integer Rupiah minor units.
     *
     * @param ProductVariant $variant
     * @param string $currency
     * @param bool $lockRow
     * @return int
     * @throws InactiveVariantException
     * @throws VariantPriceUnavailableException
     */
    public function resolvePrice(
        ProductVariant $variant,
        string $currency = 'IDR',
        bool $lockRow = true
    ): int {
        if (!$variant->active) {
            throw new InactiveVariantException("Product variant [{$variant->id}] is inactive.");
        }

        $inventoryItem = $variant->inventoryItem;
        if ($inventoryItem === null || !$inventoryItem->active) {
            throw new InactiveVariantException("Inventory item for variant [{$variant->id}] is missing or inactive.");
        }

        $query = ProductVariantPrice::query()
            ->where('product_variant_id', $variant->id)
            ->where('currency', $currency)
            ->where('active', true);

        if ($lockRow) {
            $query->lockForUpdate();
        }

        /** @var ProductVariantPrice|null $priceRecord */
        $priceRecord = $query->first();

        if ($priceRecord === null) {
            throw new VariantPriceUnavailableException(
                "No active authoritative {$currency} price found for variant [{$variant->id}]."
            );
        }

        return (int) $priceRecord->amount;
    }
}
