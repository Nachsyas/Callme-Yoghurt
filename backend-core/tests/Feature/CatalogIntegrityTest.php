<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Catalog\GetAuthoritativeCatalogService;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private UnitOfMeasure $uomMl;

    protected function setUp(): void
    {
        parent::setUp();

        $this->uomMl = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliters',
            'category' => 'VOLUME',
        ]);
    }

    private function createProductWithVariant(
        string $name,
        string $slug,
        string $sku,
        bool $productActive = true,
        bool $variantActive = true
    ): Product {
        $product = Product::create([
            'name' => $name,
            'slug' => $slug,
            'description' => "Delicious {$name}",
            'active' => $productActive,
        ]);

        $item = InventoryItem::create([
            'code' => 'FG-' . strtoupper($slug) . '-250',
            'name' => "{$name} 250ml",
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomMl->id,
            'lot_tracked' => true,
            'active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $item->id,
            'sku' => $sku,
            'variant_name' => "{$name} 250ml",
            'net_content_quantity' => '250.000000',
            'net_content_uom_id' => $this->uomMl->id,
            'active' => $variantActive,
        ]);

        ProductVariantPrice::create([
            'product_variant_id' => $variant->id,
            'currency' => 'IDR',
            'amount' => 25000,
            'active' => true,
        ]);

        return $product;
    }

    /**
     * Test: The 7 official products are valid and retrievable by authoritative catalog service.
     */
    public function test_seven_official_products_are_retrievable(): void
    {
        $officialSlugs = [
            'plain',
            'stroberi',
            'mangga',
            'melon',
            'anggur',
            'leci',
            'vanila',
        ];

        foreach ($officialSlugs as $slug) {
            $this->createProductWithVariant(
                name: 'Callme Yoghurt ' . ucfirst($slug),
                slug: $slug,
                sku: 'CY-' . strtoupper($slug) . '-250',
                productActive: true,
                variantActive: true
            );
        }

        $service = app(GetAuthoritativeCatalogService::class);
        $result = $service->execute();

        $this->assertCount(7, $result['products']);

        $returnedSlugs = array_map(fn($p) => $p['slug'], $result['products']);
        sort($returnedSlugs);
        sort($officialSlugs);

        $this->assertEquals($officialSlugs, $returnedSlugs);
    }

    /**
     * Test: Inactive/invalid products like Pisang Ambon are NEVER returned in catalog.
     */
    public function test_inactive_or_unlisted_products_are_excluded_from_catalog(): void
    {
        // Active product (Stroberi)
        $this->createProductWithVariant('Callme Yoghurt Stroberi', 'stroberi', 'CY-STR-250', true, true);

        // Deactivated/invalid product (Pisang Ambon marked active = false to preserve historical FKs)
        $this->createProductWithVariant('Callme Yoghurt Pisang Ambon', 'pisang-ambon', 'CY-PSG-250', false, false);

        $service = app(GetAuthoritativeCatalogService::class);
        $result = $service->execute();

        $returnedSlugs = array_map(fn($p) => $p['slug'], $result['products']);

        $this->assertContains('stroberi', $returnedSlugs);
        $this->assertNotContains('pisang-ambon', $returnedSlugs);
        $this->assertNotContains('pisang', $returnedSlugs);
    }
}
