<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Database\Seeders\OfficialCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfficialCatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test: OfficialCatalogSeeder must seed master catalog data only and NEVER fabricate operational stock.
     */
    public function test_seeder_does_not_create_synthetic_inventory_lots_or_ledger_entries(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        // 1. Proves ZERO operational lots or stock ledger entries are fabricated
        $this->assertSame(0, InventoryLot::count(), 'OfficialCatalogSeeder must not fabricate InventoryLot records.');
        $this->assertSame(0, StockLedgerEntry::count(), 'OfficialCatalogSeeder must not fabricate StockLedgerEntry records.');
    }

    /**
     * Test: OfficialCatalogSeeder seeds exactly 7 products and 21 variants with current business pricing.
     */
    public function test_seeder_creates_seven_products_and_twenty_one_variants_with_correct_prices(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        // 2. Proves 7 official master products
        $products = Product::where('active', true)->get();
        $this->assertCount(7, $products);

        $expectedSlugs = ['plain', 'stroberi', 'mangga', 'melon', 'anggur', 'leci', 'vanila'];
        $actualSlugs = $products->pluck('slug')->sort()->values()->toArray();
        sort($expectedSlugs);
        $this->assertSame($expectedSlugs, $actualSlugs);

        $expectedNames = ['Anggur', 'Leci', 'Mangga', 'Melon', 'Plain', 'Stroberi', 'Vanila'];
        $actualNames = $products->pluck('name')->sort()->values()->toArray();
        $this->assertSame($expectedNames, $actualNames);

        // 3. Proves 21 master variants (7 flavors × 3 sizes)
        $variants = ProductVariant::where('active', true)->get();
        $this->assertCount(21, $variants);

        // 4. Proves 21 active prices matching current business data (16k, 30k, 55k)
        $activePrices = ProductVariantPrice::where('active', true)->get();
        $this->assertCount(21, $activePrices);

        foreach ($variants as $variant) {
            $price = $variant->prices()->where('active', true)->first();
            $this->assertNotNull($price, "Variant {$variant->sku} must have an active price.");
            $this->assertSame('IDR', $price->currency);

            $quantity = (int) (float) $variant->net_content_quantity;
            $expectedAmount = match ($quantity) {
                250 => 16000,
                500 => 30000,
                1000 => 55000,
                default => null,
            };

            $this->assertNotNull($expectedAmount, "Variant {$variant->sku} has unexpected quantity {$quantity}.");
            $this->assertSame($expectedAmount, $price->amount);
        }
    }

    /**
     * Test: OfficialCatalogSeeder rerun preserves legitimate Admin price changes and does NOT restore bootstrap price.
     */
    public function test_seeder_rerun_preserves_legitimate_admin_price_change(): void
    {
        // 1. Seed fresh DB (Plain 250ml gets initial price 16,000)
        $this->seed(OfficialCatalogSeeder::class);

        $plain250 = ProductVariant::where('sku', 'CY-PLAIN-250')->firstOrFail();
        $initialPrice = ProductVariantPrice::where('product_variant_id', $plain250->id)
            ->where('active', true)
            ->firstOrFail();
        $this->assertSame(16000, $initialPrice->amount);

        // 2. Simulate legitimate Admin price update to 17,000 (deactivate old, create new active)
        $initialPrice->update(['active' => false]);
        $adminPrice = ProductVariantPrice::create([
            'product_variant_id' => $plain250->id,
            'currency' => 'IDR',
            'amount' => 17000,
            'active' => true,
        ]);

        // 3. Rerun OfficialCatalogSeeder
        $this->seed(OfficialCatalogSeeder::class);

        // 4. Assert 17,000 remains active
        $activePrice = ProductVariantPrice::where('product_variant_id', $plain250->id)
            ->where('active', true)
            ->firstOrFail();
        $this->assertSame(17000, $activePrice->amount, 'Admin price 17,000 must remain active after reseed.');
        $this->assertSame($adminPrice->id, $activePrice->id);

        // 5. Assert seeder did not restore 16,000 as active
        $allActive16k = ProductVariantPrice::where('product_variant_id', $plain250->id)
            ->where('amount', 16000)
            ->where('active', true)
            ->count();
        $this->assertSame(0, $allActive16k, 'Seeder must not restore 16,000 as active.');

        // Total price records for Plain 250ml should still be 2 (initial deactivated 16k + active 17k)
        $totalPrices = ProductVariantPrice::where('product_variant_id', $plain250->id)->count();
        $this->assertSame(2, $totalPrices);
    }

    /**
     * Test: OfficialCatalogSeeder rerun preserves Admin product inactive state.
     */
    public function test_seeder_rerun_preserves_product_inactive_state(): void
    {
        // 1. Seed fresh DB
        $this->seed(OfficialCatalogSeeder::class);

        // 2. Admin intentionally deactivates a product (e.g. Melon)
        $melon = Product::where('slug', 'melon')->firstOrFail();
        $this->assertTrue($melon->active);
        $melon->update(['active' => false]);

        // 3. Rerun OfficialCatalogSeeder
        $this->seed(OfficialCatalogSeeder::class);

        // 4. Assert product remains inactive
        $melonRefreshed = Product::where('slug', 'melon')->firstOrFail();
        $this->assertFalse($melonRefreshed->active, 'Admin deactivated product must remain inactive after reseed.');
    }

    /**
     * Test: OfficialCatalogSeeder rerun does not duplicate products or variants.
     */
    public function test_seeder_rerun_does_not_duplicate_products_or_variants(): void
    {
        // 1. First seed
        $this->seed(OfficialCatalogSeeder::class);
        $this->assertSame(7, Product::count());
        $this->assertSame(21, ProductVariant::count());
        $this->assertSame(21, ProductVariantPrice::count());

        // 2. Second seed (rerun)
        $this->seed(OfficialCatalogSeeder::class);
        $this->assertSame(7, Product::count(), 'Products must not be duplicated on reseed.');
        $this->assertSame(21, ProductVariant::count(), 'Variants must not be duplicated on reseed.');
        $this->assertSame(21, ProductVariantPrice::count(), 'Prices must not be duplicated on reseed.');
    }

    /**
     * Test: OfficialCatalogSeeder rerun preserves Admin product name changes.
     */
    public function test_seeder_rerun_preserves_admin_product_name_change(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        $plain = Product::where('slug', 'plain')->firstOrFail();
        $plain->update(['name' => 'Plain Special Reserve']);

        $this->seed(OfficialCatalogSeeder::class);

        $plainRefreshed = Product::where('slug', 'plain')->firstOrFail();
        $this->assertSame('Plain Special Reserve', $plainRefreshed->name);
    }

    /**
     * Test: OfficialCatalogSeeder rerun does NOT recreate old baseline slug when Admin changes slug.
     */
    public function test_seeder_rerun_does_not_recreate_old_slug_when_admin_renames_slug(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        $plain = Product::where('slug', 'plain')->firstOrFail();
        $plain->update(['slug' => 'plain-original']);

        $this->seed(OfficialCatalogSeeder::class);

        // Assert plain-original is preserved
        $this->assertTrue(Product::where('slug', 'plain-original')->exists());

        // Assert old slug 'plain' was NOT recreated
        $this->assertFalse(Product::where('slug', 'plain')->exists(), 'Seeder must NOT recreate baseline slug if renamed.');
        $this->assertSame(7, Product::count());
    }

    /**
     * Test: OfficialCatalogSeeder rerun does NOT recreate old baseline SKU when Admin changes variant SKU.
     */
    public function test_seeder_rerun_does_not_recreate_old_sku_when_admin_renames_sku(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        $variant = ProductVariant::where('sku', 'CY-PLAIN-250')->firstOrFail();
        $variant->update(['sku' => 'CY-PLAIN-250-NEW']);

        $this->seed(OfficialCatalogSeeder::class);

        // Assert renamed SKU is preserved
        $this->assertTrue(ProductVariant::where('sku', 'CY-PLAIN-250-NEW')->exists());

        // Assert old SKU CY-PLAIN-250 was NOT recreated
        $this->assertFalse(ProductVariant::where('sku', 'CY-PLAIN-250')->exists(), 'Seeder must NOT recreate baseline SKU if renamed.');
        $this->assertSame(21, ProductVariant::count());
    }

    /**
     * Test: OfficialCatalogSeeder rerun preserves future products created by Admin.
     */
    public function test_seeder_rerun_preserves_future_product_created_by_admin(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        // Admin adds future product
        Product::create([
            'name' => 'Blueberry',
            'slug' => 'blueberry',
            'description' => 'Yoghurt rasa Blueberry.',
            'active' => true,
        ]);

        $this->assertSame(8, Product::count());

        $this->seed(OfficialCatalogSeeder::class);

        // Assert Blueberry still exists and count remains 8
        $this->assertSame(8, Product::count());
        $this->assertTrue(Product::where('slug', 'blueberry')->exists());
    }
}
