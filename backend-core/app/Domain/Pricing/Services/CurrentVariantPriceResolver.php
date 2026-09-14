<?php

declare(strict_types=1);

namespace App\Domain\Pricing\Services;

use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Pricing\Exceptions\VariantPriceUnavailableException;
use App\Domain\Pricing\Models\ProductVariantPrice;

class CurrentVariantPriceResolver
{
    /**
     * Resolve the authoritative current retail price for a product variant.
     *
     * Invariants (ADR-0005 / Gate 0E.1.1):
     * - Product family must be active.
     * - Product variant must be active.
     * - Associated InventoryItem must be active and of type FINISHED_GOOD.
     * - Active price record in currency 'IDR' must exist.
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
        if ($currency !== 'IDR') {
            throw new VariantPriceUnavailableException("Only IDR currency is supported for retail checkout.");
        }

        if (!$variant->active) {
            throw new InactiveVariantException("Product variant [{$variant->id}] is inactive.");
        }

        $product = $variant->product;
        if ($product === null || !$product->active) {
            throw new InactiveVariantException("Product family for variant [{$variant->id}] is missing or inactive.");
        }

        $inventoryItem = $variant->inventoryItem;
        if ($inventoryItem === null || !$inventoryItem->active) {
            throw new InactiveVariantException("Inventory item for variant [{$variant->id}] is missing or inactive.");
        }

        if ($inventoryItem->type !== ItemType::FINISHED_GOOD) {
            throw new InactiveVariantException(
                "Only FINISHED_GOOD items are sellable at checkout. Variant [{$variant->id}] has item type [{$inventoryItem->type->value}]."
            );
        }

        $query = ProductVariantPrice::query()
            ->where('product_variant_id', $variant->id)
            ->where('currency', 'IDR')
            ->where('active', true);

        if ($lockRow) {
            $query->lockForUpdate();
        }

        /** @var ProductVariantPrice|null $priceRecord */
        $priceRecord = $query->first();

        if ($priceRecord === null) {
            throw new VariantPriceUnavailableException(
                "No active authoritative IDR price found for variant [{$variant->id}]."
            );
        }

        return (int) $priceRecord->amount;
    }
}
