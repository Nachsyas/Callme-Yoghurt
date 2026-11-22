<?php

declare(strict_types=1);

namespace App\Application\Admin\Catalog;

use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class AdminCatalogService
{
    /**
     * Retrieve all products with their variants, active prices, inventory item mappings, and history.
     */
    public function listProducts(): array
    {
        $products = Product::query()
            ->with([
                'variants' => function ($variantQuery) {
                    $variantQuery
                        ->with([
                            'inventoryItem',
                            'netContentUom',
                            'prices' => function ($priceQuery) {
                                $priceQuery->orderByDesc('created_at');
                            },
                        ])
                        ->orderBy('sku', 'asc');
                },
            ])
            ->orderBy('name', 'asc')
            ->get();

        return [
            'products' => $products->map(function (Product $product) {
                return [
                    'id' => (string) $product->id,
                    'name' => (string) $product->name,
                    'slug' => (string) $product->slug,
                    'description' => $product->description,
                    'active' => (bool) $product->active,
                    'created_at' => $product->created_at?->toIso8601String(),
                    'updated_at' => $product->updated_at?->toIso8601String(),
                    'variants' => $product->variants->map(function (ProductVariant $variant) {
                        $activePrice = $variant->prices->firstWhere('active', true);
                        return [
                            'id' => (string) $variant->id,
                            'product_id' => (string) $variant->product_id,
                            'inventory_item_id' => (string) $variant->inventory_item_id,
                            'inventory_item' => $variant->inventoryItem ? [
                                'id' => (string) $variant->inventoryItem->id,
                                'code' => (string) $variant->inventoryItem->code,
                                'name' => (string) $variant->inventoryItem->name,
                                'type' => $variant->inventoryItem->type->value,
                                'active' => (bool) $variant->inventoryItem->active,
                            ] : null,
                            'sku' => (string) $variant->sku,
                            'variant_name' => (string) $variant->variant_name,
                            'net_content_quantity' => $variant->net_content_quantity !== null
                                ? (float) $variant->net_content_quantity
                                : null,
                            'net_content_uom_id' => $variant->net_content_uom_id ? (string) $variant->net_content_uom_id : null,
                            'net_content_uom' => $variant->netContentUom ? [
                                'id' => (string) $variant->netContentUom->id,
                                'code' => (string) $variant->netContentUom->code,
                                'name' => (string) $variant->netContentUom->name,
                            ] : null,
                            'active' => (bool) $variant->active,
                            'price' => $activePrice ? [
                                'id' => (string) $activePrice->id,
                                'currency' => (string) $activePrice->currency,
                                'amount' => (int) $activePrice->amount,
                            ] : null,
                            'price_history' => $variant->prices->map(function (ProductVariantPrice $p) {
                                return [
                                    'id' => (string) $p->id,
                                    'currency' => (string) $p->currency,
                                    'amount' => (int) $p->amount,
                                    'active' => (bool) $p->active,
                                    'created_at' => $p->created_at?->toIso8601String(),
                                ];
                            })->values()->all(),
                        ];
                    })->values()->all(),
                ];
            })->values()->all(),
        ];
    }

    /**
     * Create a new product.
     */
    public function createProduct(array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): Product
    {
        return DB::transaction(function () use ($data, $adminUserId, $ip, $userAgent) {
            $slug = strtolower(trim((string) ($data['slug'] ?? '')));
            if ($slug === '') {
                throw new InvalidArgumentException('Product slug is required.');
            }

            if (Product::where('slug', $slug)->exists()) {
                throw new InvalidArgumentException("Product slug [{$slug}] already exists.");
            }

            $name = trim((string) ($data['name'] ?? ''));
            if ($name === '') {
                throw new InvalidArgumentException('Product name is required.');
            }

            $product = Product::create([
                'name' => $name,
                'slug' => $slug,
                'description' => isset($data['description']) ? trim((string) $data['description']) : null,
                'active' => (bool) ($data['active'] ?? true),
            ]);

            AdminAuditLog::record(
                'CATALOG_PRODUCT_CREATED',
                $adminUserId,
                [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'active' => $product->active,
                ],
                $ip,
                $userAgent
            );

            return $product;
        });
    }

    /**
     * Update product metadata.
     */
    public function updateProduct(string $id, array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): Product
    {
        return DB::transaction(function () use ($id, $data, $adminUserId, $ip, $userAgent) {
            /** @var Product $product */
            $product = Product::lockForUpdate()->findOrFail($id);

            $updates = [];
            if (array_key_exists('name', $data)) {
                $name = trim((string) $data['name']);
                if ($name === '') {
                    throw new InvalidArgumentException('Product name cannot be empty.');
                }
                $updates['name'] = $name;
            }

            if (array_key_exists('slug', $data)) {
                $slug = strtolower(trim((string) $data['slug']));
                if ($slug === '') {
                    throw new InvalidArgumentException('Product slug cannot be empty.');
                }
                if (Product::where('slug', $slug)->where('id', '!=', $id)->exists()) {
                    throw new InvalidArgumentException("Product slug [{$slug}] already exists.");
                }
                $updates['slug'] = $slug;
            }

            if (array_key_exists('description', $data)) {
                $updates['description'] = $data['description'] !== null ? trim((string) $data['description']) : null;
            }

            if (array_key_exists('active', $data)) {
                $updates['active'] = (bool) $data['active'];
            }

            $product->update($updates);

            AdminAuditLog::record(
                'CATALOG_PRODUCT_UPDATED',
                $adminUserId,
                [
                    'product_id' => $product->id,
                    'updated_fields' => array_keys($updates),
                ],
                $ip,
                $userAgent
            );

            return $product->fresh();
        });
    }

    /**
     * Soft deactivation of product. Preserves historical orders and variants.
     */
    public function deactivateProduct(string $id, string $adminUserId, ?string $ip = null, ?string $userAgent = null): Product
    {
        return DB::transaction(function () use ($id, $adminUserId, $ip, $userAgent) {
            /** @var Product $product */
            $product = Product::lockForUpdate()->findOrFail($id);
            $product->update(['active' => false]);

            AdminAuditLog::record(
                'CATALOG_PRODUCT_DEACTIVATED',
                $adminUserId,
                ['product_id' => $product->id, 'slug' => $product->slug],
                $ip,
                $userAgent
            );

            return $product->fresh();
        });
    }

    /**
     * Create product variant.
     */
    public function createVariant(array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): ProductVariant
    {
        return DB::transaction(function () use ($data, $adminUserId, $ip, $userAgent) {
            $productId = (string) ($data['product_id'] ?? '');
            if (!Product::where('id', $productId)->exists()) {
                throw new InvalidArgumentException("Product [{$productId}] not found.");
            }

            $inventoryItemId = (string) ($data['inventory_item_id'] ?? '');
            $inventoryItem = InventoryItem::find($inventoryItemId);
            if ($inventoryItem === null) {
                throw new InvalidArgumentException("Inventory item [{$inventoryItemId}] not found.");
            }

            $sku = strtoupper(trim((string) ($data['sku'] ?? '')));
            if ($sku === '') {
                throw new InvalidArgumentException('Variant SKU is required.');
            }
            if (ProductVariant::where('sku', $sku)->exists()) {
                throw new InvalidArgumentException("SKU [{$sku}] already exists.");
            }

            $variantName = trim((string) ($data['variant_name'] ?? $data['name'] ?? ''));
            if ($variantName === '') {
                throw new InvalidArgumentException('Variant name is required.');
            }

            $uomId = isset($data['net_content_uom_id']) && $data['net_content_uom_id'] !== ''
                ? (string) $data['net_content_uom_id']
                : null;
            if ($uomId !== null && !UnitOfMeasure::where('id', $uomId)->exists()) {
                throw new InvalidArgumentException("UOM [{$uomId}] not found.");
            }

            $netContentQty = isset($data['net_content_quantity']) && $data['net_content_quantity'] !== ''
                ? (float) $data['net_content_quantity']
                : null;

            $variant = ProductVariant::create([
                'product_id' => $productId,
                'inventory_item_id' => $inventoryItemId,
                'sku' => $sku,
                'variant_name' => $variantName,
                'net_content_quantity' => $netContentQty,
                'net_content_uom_id' => $uomId,
                'active' => (bool) ($data['active'] ?? true),
            ]);

            // Optional initial price
            if (isset($data['price'])) {
                if (!is_numeric($data['price']) || (int) $data['price'] <= 0 || (string) (int) $data['price'] !== (string) $data['price']) {
                    throw new InvalidArgumentException('Price amount must be an integer greater than zero.');
                }
                $amount = (int) $data['price'];
                ProductVariantPrice::create([
                    'product_variant_id' => $variant->id,
                    'currency' => 'IDR',
                    'amount' => $amount,
                    'active' => true,
                ]);
            }

            AdminAuditLog::record(
                'CATALOG_VARIANT_CREATED',
                $adminUserId,
                [
                    'variant_id' => $variant->id,
                    'product_id' => $productId,
                    'sku' => $variant->sku,
                    'inventory_item_id' => $inventoryItemId,
                ],
                $ip,
                $userAgent
            );

            return $variant->load(['inventoryItem', 'netContentUom', 'prices']);
        });
    }

    /**
     * Update product variant metadata.
     */
    public function updateVariant(string $id, array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): ProductVariant
    {
        return DB::transaction(function () use ($id, $data, $adminUserId, $ip, $userAgent) {
            /** @var ProductVariant $variant */
            $variant = ProductVariant::lockForUpdate()->findOrFail($id);

            $updates = [];
            if (array_key_exists('sku', $data)) {
                $sku = strtoupper(trim((string) $data['sku']));
                if ($sku === '') {
                    throw new InvalidArgumentException('SKU cannot be empty.');
                }
                if (ProductVariant::where('sku', $sku)->where('id', '!=', $id)->exists()) {
                    throw new InvalidArgumentException("SKU [{$sku}] already exists.");
                }
                $updates['sku'] = $sku;
            }

            if (array_key_exists('variant_name', $data) || array_key_exists('name', $data)) {
                $name = trim((string) ($data['variant_name'] ?? $data['name'] ?? ''));
                if ($name === '') {
                    throw new InvalidArgumentException('Variant name cannot be empty.');
                }
                $updates['variant_name'] = $name;
            }

            if (array_key_exists('inventory_item_id', $data)) {
                $itemId = (string) $data['inventory_item_id'];
                if (!InventoryItem::where('id', $itemId)->exists()) {
                    throw new InvalidArgumentException("Inventory item [{$itemId}] not found.");
                }
                $updates['inventory_item_id'] = $itemId;
            }

            if (array_key_exists('net_content_quantity', $data)) {
                $updates['net_content_quantity'] = $data['net_content_quantity'] !== null
                    ? (float) $data['net_content_quantity']
                    : null;
            }

            if (array_key_exists('net_content_uom_id', $data)) {
                $uomId = $data['net_content_uom_id'] !== null ? (string) $data['net_content_uom_id'] : null;
                if ($uomId !== null && !UnitOfMeasure::where('id', $uomId)->exists()) {
                    throw new InvalidArgumentException("UOM [{$uomId}] not found.");
                }
                $updates['net_content_uom_id'] = $uomId;
            }

            if (array_key_exists('active', $data)) {
                $updates['active'] = (bool) $data['active'];
            }

            $variant->update($updates);

            AdminAuditLog::record(
                'CATALOG_VARIANT_UPDATED',
                $adminUserId,
                [
                    'variant_id' => $variant->id,
                    'sku' => $variant->sku,
                    'updated_fields' => array_keys($updates),
                ],
                $ip,
                $userAgent
            );

            return $variant->fresh(['inventoryItem', 'netContentUom', 'prices']);
        });
    }

    /**
     * Soft deactivation of variant.
     */
    public function deactivateVariant(string $id, string $adminUserId, ?string $ip = null, ?string $userAgent = null): ProductVariant
    {
        return DB::transaction(function () use ($id, $adminUserId, $ip, $userAgent) {
            /** @var ProductVariant $variant */
            $variant = ProductVariant::lockForUpdate()->findOrFail($id);
            $variant->update(['active' => false]);

            AdminAuditLog::record(
                'CATALOG_VARIANT_DEACTIVATED',
                $adminUserId,
                ['variant_id' => $variant->id, 'sku' => $variant->sku],
                $ip,
                $userAgent
            );

            return $variant->fresh(['inventoryItem', 'netContentUom', 'prices']);
        });
    }

    /**
     * Authoritative price change.
     * Within one ACID transaction:
     * 1. Lock variant row.
     * 2. Deactivate previous active IDR price(s).
     * 3. Insert new active IDR price.
     * Preserves entire pricing history without violating unique partial index.
     */
    public function changeVariantPrice(
        string $variantId,
        int $amount,
        string $adminUserId,
        ?string $ip = null,
        ?string $userAgent = null
    ): ProductVariantPrice {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Price amount must be greater than zero.');
        }

        return DB::transaction(function () use ($variantId, $amount, $adminUserId, $ip, $userAgent) {
            /** @var ProductVariant $variant */
            $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);

            /** @var ProductVariantPrice|null $previousActive */
            $previousActive = ProductVariantPrice::where('product_variant_id', $variantId)
                ->where('currency', 'IDR')
                ->where('active', true)
                ->lockForUpdate()
                ->first();

            $previousAmount = $previousActive ? (int) $previousActive->amount : null;

            if ($previousActive !== null) {
                $previousActive->update(['active' => false]);
            }

            $newPrice = ProductVariantPrice::create([
                'product_variant_id' => $variantId,
                'currency' => 'IDR',
                'amount' => $amount,
                'active' => true,
            ]);

            AdminAuditLog::record(
                'CATALOG_PRICE_CHANGED',
                $adminUserId,
                [
                    'variant_id' => $variantId,
                    'sku' => $variant->sku,
                    'currency' => 'IDR',
                    'previous_amount' => $previousAmount,
                    'new_amount' => $amount,
                ],
                $ip,
                $userAgent
            );

            return $newPrice;
        });
    }
}
