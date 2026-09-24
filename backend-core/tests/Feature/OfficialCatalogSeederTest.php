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
     * Test: OfficialCatalogSeeder preserves price history non-destructively when updating prices.
     */
    public function test_seeder_preserves_price_history_non_destructively(): void
    {
        $this->seed(OfficialCatalogSeeder::class);

        // Manually simulate an older historical price for Plain 250ml
        $plain250 = ProductVariant::where('sku', 'CY-PLAIN-250')->firstOrFail();
        $currentPrice = ProductVariantPrice::where('product_variant_id', $plain250->id)
            ->where('active', true)
            ->firstOrFail();

        // Update the active price to an older value (e.g. 15,000)
        $currentPrice->update(['amount' => 15000]);

        // Re-run the seeder (which specifies 16,000 for 250ml)
        $this->seed(OfficialCatalogSeeder::class);

        // Verify the old price (15k) was deactivated, not deleted
        $prices = ProductVariantPrice::where('product_variant_id', $plain250->id)->get();
        $this->assertCount(2, $prices, 'Price history must be preserved as multiple immutable records.');

        $inactivePrice = $prices->firstWhere('active', false);
        $this->assertNotNull($inactivePrice);
        $this->assertSame(15000, $inactivePrice->amount);

        $activePrice = $prices->firstWhere('active', true);
        $this->assertNotNull($activePrice);
        $this->assertSame(16000, $activePrice->amount);
    }
}
