<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthoritativeCatalogTest extends TestCase
{
    use RefreshDatabase;

    private string $validToken = 'test-erp-service-token-secret-64ch';

    private UnitOfMeasure $uomMl;
    private Product $activeProduct;
    private InventoryItem $finishedGoodItem;
    private ProductVariant $sellableVariant;
    private ProductVariantPrice $activeIdrPrice;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.internal.service_token' => $this->validToken,
        ]);

        $this->uomMl = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliters',
            'category' => 'VOLUME',
        ]);

        $this->activeProduct = Product::create([
            'name' => 'Callme Yoghurt Stroberi',
            'slug' => 'stroberi',
            'description' => 'Yoghurt stroberi segar',
            'active' => true,
        ]);

        $this->finishedGoodItem = InventoryItem::create([
            'code' => 'FG-STR-250',
            'name' => 'Stroberi 250ml Finished Good',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomMl->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $this->sellableVariant = ProductVariant::create([
            'product_id' => $this->activeProduct->id,
            'inventory_item_id' => $this->finishedGoodItem->id,
            'sku' => 'CY-STR-250',
            'variant_name' => 'Stroberi 250ml',
            'net_content_quantity' => '250.000000',
            'net_content_uom_id' => $this->uomMl->id,
            'active' => true,
        ]);

        $this->activeIdrPrice = ProductVariantPrice::create([
            'product_variant_id' => $this->sellableVariant->id,
            'currency' => 'IDR',
            'amount' => 25000,
            'active' => true,
        ]);
    }

    /**
     * Proves internal catalog endpoint requires authentication.
     */
    public function test_internal_catalog_requires_authentication(): void
    {
        // 1. Missing bearer token -> 401
        $resNoAuth = $this->getJson('/api/internal/catalog/products');
        $resNoAuth->assertStatus(401);
        $resNoAuth->assertJson([
            'error' => 'Unauthorized: missing bearer token',
        ]);

        // 2. Invalid bearer token -> 401
        $resInvalidAuth = $this->withHeaders([
            'Authorization' => 'Bearer forged-invalid-token',
        ])->getJson('/api/internal/catalog/products');
        $resInvalidAuth->assertStatus(401);
        $resInvalidAuth->assertJson([
            'error' => 'Unauthorized: invalid service token',
        ]);

        // 3. Valid bearer token -> 200
        $resValid = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');
        $resValid->assertStatus(200);
    }

    /**
     * Proves valid FINISHED_GOOD + active IDR price returns sellable catalog.
     */
    public function test_valid_finished_good_and_active_idr_price_returned(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertArrayHasKey('products', $data);
        $this->assertCount(1, $data['products']);

        $product = $data['products'][0];
        $this->assertSame('stroberi', $product['slug']);
        $this->assertSame('Callme Yoghurt Stroberi', $product['name']);
        $this->assertCount(1, $product['variants']);

        $variant = $product['variants'][0];
        $this->assertSame((string) $this->sellableVariant->id, $variant['variant_id']);
        $this->assertSame('CY-STR-250', $variant['sku']);
        $this->assertSame('Stroberi 250ml', $variant['name']);
        $this->assertSame('250.000000', $variant['net_content']['quantity']);
        $this->assertSame('ML', $variant['net_content']['uom']);

        // Assert price details
        $this->assertSame('IDR', $variant['price']['currency']);
        $this->assertSame(25000, $variant['price']['amount']);
        $this->assertIsInt($variant['price']['amount']);
    }

    /**
     * Proves returned variant_id is actual ProductVariant UUID.
     */
    public function test_returned_variant_id_is_actual_product_variant_uuid(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $variantId = $response->json('products.0.variants.0.variant_id');

        $this->assertIsString($variantId);
        $this->assertSame((string) $this->sellableVariant->id, $variantId);
        // Assert matches UUID regex
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $variantId
        );
    }

    /**
     * Proves price amount is integer and in IDR.
     */
    public function test_price_amount_is_integer(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $price = $response->json('products.0.variants.0.price');

        $this->assertSame('IDR', $price['currency']);
        $this->assertIsInt($price['amount']);
        $this->assertSame(25000, $price['amount']);
    }

    /**
     * Proves inactive Product is excluded from catalog.
     */
    public function test_inactive_product_excluded(): void
    {
        $this->activeProduct->update(['active' => false]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $products = $response->json('products');

        $this->assertCount(0, $products);
    }

    /**
     * Proves inactive ProductVariant is excluded from catalog.
     */
    public function test_inactive_product_variant_excluded(): void
    {
        $this->sellableVariant->update(['active' => false]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $products = $response->json('products');

        $this->assertCount(0, $products);
    }

    /**
     * Proves inactive InventoryItem is excluded from catalog.
     */
    public function test_inactive_inventory_item_excluded(): void
    {
        $this->finishedGoodItem->update(['active' => false]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $products = $response->json('products');

        $this->assertCount(0, $products);
    }

    /**
     * Proves RAW_MATERIAL inventory items are excluded from retail catalog.
     */
    public function test_raw_material_excluded(): void
    {
        $this->finishedGoodItem->update(['type' => ItemType::RAW_MATERIAL]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $products = $response->json('products');

        $this->assertCount(0, $products);
    }

    /**
     * Proves PACKAGING inventory items are excluded from retail catalog.
     */
    public function test_packaging_excluded(): void
    {
        $this->finishedGoodItem->update(['type' => ItemType::PACKAGING]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $products = $response->json('products');

        $this->assertCount(0, $products);
    }

    /**
     * Proves variants missing an active IDR price are excluded.
     */
    public function test_missing_active_idr_price_excluded(): void
    {
        // 1. Deactivate current IDR price
        $this->activeIdrPrice->update(['active' => false]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json('products'));

        // 2. Add USD price only -> still excluded
        ProductVariantPrice::create([
            'product_variant_id' => $this->sellableVariant->id,
            'currency' => 'USD',
            'amount' => 2,
            'active' => true,
        ]);

        $responseUSD = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $responseUSD->assertStatus(200);
        $this->assertCount(0, $responseUSD->json('products'));
    }

    /**
     * Proves internal operational data (stock, lots, warehouses, reservations, allocations, ledger) is never leaked.
     */
    public function test_no_stock_lot_reservation_internals_leaked(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->validToken,
        ])->getJson('/api/internal/catalog/products');

        $response->assertStatus(200);
        $rawJson = $response->getContent();

        // Forbidden internal keys
        $forbiddenKeys = [
            'stock',
            'quantity_on_hand',
            'lots',
            'lot_id',
            'inventory_lot_id',
            'warehouses',
            'warehouse_id',
            'reservations',
            'reservation_id',
            'allocations',
            'allocation_id',
            'ledger',
            'ledger_entries',
            'stock_ledger_entries',
            'password',
            'token',
            'secret',
        ];

        foreach ($forbiddenKeys as $key) {
            $this->assertStringNotContainsString(
                '"' . $key . '"',
                $rawJson,
                "Catalog response leaked internal sensitive key [{$key}]."
            );
        }

        // Verify top-level structure contains ONLY 'products'
        $data = $response->json();
        $this->assertSame(['products'], array_keys($data));
    }
}
