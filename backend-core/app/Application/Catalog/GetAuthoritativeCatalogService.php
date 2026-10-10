<?php

declare(strict_types=1);

namespace App\Application\Catalog;

use App\Domain\Catalog\Models\Product;
use App\Domain\Inventory\Enums\ItemType;

class GetAuthoritativeCatalogService
{
    /**
     * Retrieve authoritative sellable catalog matching explicit DTO.
     *
     * Invariants (Gate 0E.2A):
     * - Product.active = true
     * - ProductVariant.active = true
     * - InventoryItem.active = true
     * - InventoryItem.type = FINISHED_GOOD
     * - Active IDR ProductVariantPrice exists (amount is integer)
     * - Zero internal stock, lot, warehouse, reservation, or ledger data leaked.
     *
     * @return array{
     *     products: array<int, array{
     *         slug: string,
     *         name: string,
     *         variants: array<int, array{
     *             variant_id: string,
     *             sku: string,
     *             name: string,
     *             net_content: array{
     *                 quantity: string|null,
     *                 uom: string|null
     *             },
     *             price: array{
     *                 currency: string,
     *                 amount: int
     *             }
     *         }>
     *     }>
     * }
     */
    public function execute(): array
    {
        $products = Product::query()
            ->where('active', true)
            ->whereHas('variants', function ($variantQuery) {
                $variantQuery->where('active', true)
                    ->whereHas('inventoryItem', function ($itemQuery) {
                        $itemQuery->where('active', true)
                            ->where('type', ItemType::FINISHED_GOOD);
                    })
                    ->whereHas('prices', function ($priceQuery) {
                        $priceQuery->where('active', true)
                            ->where('currency', 'IDR');
                    });
            })
            ->with([
                'variants' => function ($variantQuery) {
                    $variantQuery->where('active', true)
                        ->whereHas('inventoryItem', function ($itemQuery) {
                            $itemQuery->where('active', true)
                                ->where('type', ItemType::FINISHED_GOOD);
                        })
                        ->whereHas('prices', function ($priceQuery) {
                            $priceQuery->where('active', true)
                                ->where('currency', 'IDR');
                        })
                        ->with([
                            'netContentUom',
                            'prices' => function ($priceQuery) {
                                $priceQuery->where('active', true)
                                    ->where('currency', 'IDR');
                            },
                        ])
                        ->orderBy('sku', 'asc');
                },
            ])
            ->orderBy('name', 'asc')
            ->get();

        $dtoProducts = [];

        foreach ($products as $product) {
            $dtoVariants = [];

            foreach ($product->variants as $variant) {
                $activePrice = $variant->prices->firstWhere('currency', 'IDR');
                if ($activePrice === null || !$activePrice->active) {
                    continue;
                }

                $netContentQuantity = $variant->net_content_quantity !== null
                    ? (string) $variant->net_content_quantity
                    : null;
                $netContentUom = $variant->netContentUom?->code;

                $dtoVariants[] = [
                    'variant_id' => (string) $variant->id,
                    'sku' => (string) $variant->sku,
                    'name' => (string) $variant->variant_name,
                    'net_content' => [
                        'quantity' => $netContentQuantity,
                        'uom' => $netContentUom,
                    ],
                    'price' => [
                        'currency' => 'IDR',
                        'amount' => (int) $activePrice->amount,
                    ],
                ];
            }

            if (empty($dtoVariants)) {
                continue;
            }

            $dtoProducts[] = [
                'slug' => (string) $product->slug,
                'name' => (string) $product->name,
                'variants' => $dtoVariants,
            ];
        }

        return [
            'products' => $dtoProducts,
        ];
    }
}
