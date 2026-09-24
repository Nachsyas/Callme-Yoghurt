<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Illuminate\Database\Seeder;

class OfficialCatalogSeeder extends Seeder
{
    /**
     * Seed authoritative catalog master data: products, variants, prices, warehouse, and UOMs.
     * Master data seeder MUST NOT fabricate operational inventory lots or stock ledger entries.
     */
    public function run(): void
    {
        // 1. Units of Measure
        $uomMl = UnitOfMeasure::firstOrCreate(
            ['code' => 'ML'],
            ['name' => 'Milliliters', 'category' => 'VOLUME']
        );

        $uomPcs = UnitOfMeasure::firstOrCreate(
            ['code' => 'PCS'],
            ['name' => 'Pieces', 'category' => 'UNIT']
        );

        // 2. Fulfillment Warehouse
        $warehouse = Warehouse::firstOrCreate(
            ['code' => 'WH-MAIN'],
            [
                'name' => 'Main Cold Chain Fulfillment Center — Bambu Apus, Jakarta Timur',
                'active' => true,
            ]
        );

        // 3. The 7 Official Flavors (Current Master Business Data)
        $officialFlavors = [
            [
                'slug' => 'plain',
                'name' => 'Plain Pure Original',
                'description' => 'Yoghurt stirred segar kualitas homemade Callme Yoghurt tanpa perisa tambahan.',
            ],
            [
                'slug' => 'stroberi',
                'name' => 'Stroberi Summer Blush',
                'description' => 'Yoghurt stirred segar dengan sentuhan buah stroberi alami dan rasa asam-manis seimbang.',
            ],
            [
                'slug' => 'mangga',
                'name' => 'Mangga Tropical Gold',
                'description' => 'Yoghurt stirred segar dengan sari mangga tropis harum dan tekstur lembut.',
            ],
            [
                'slug' => 'melon',
                'name' => 'Melon Emerald Fresh',
                'description' => 'Yoghurt stirred segar dengan aroma melon hijau yang harum dan menyegarkan.',
            ],
            [
                'slug' => 'anggur',
                'name' => 'Anggur Royal Purple',
                'description' => 'Yoghurt stirred segar dengan rasa anggur ungu manis legit dan segar khas Callme Yoghurt.',
            ],
            [
                'slug' => 'leci',
                'name' => 'Leci Breeze Lychee',
                'description' => 'Yoghurt stirred segar dengan aroma dan rasa leci yang harum lembut.',
            ],
            [
                'slug' => 'vanila',
                'name' => 'Vanila Velvet Orchid',
                'description' => 'Yoghurt stirred segar berpadu kelembutan aroma vanila klasik.',
            ],
        ];

        $sizes = [
            ['ml' => 250, 'price' => 16000, 'label' => '250ml'],
            ['ml' => 500, 'price' => 30000, 'label' => '500ml'],
            ['ml' => 1000, 'price' => 55000, 'label' => '1000ml'],
        ];

        foreach ($officialFlavors as $flavor) {
            $product = Product::firstOrCreate(
                ['slug' => $flavor['slug']],
                [
                    'name' => $flavor['name'],
                    'description' => $flavor['description'],
                    'active' => true,
                ]
            );

            foreach ($sizes as $size) {
                $sku = strtoupper("CY-{$flavor['slug']}-{$size['ml']}");

                $item = InventoryItem::firstOrCreate(
                    ['code' => "FG-{$sku}"],
                    [
                        'name' => "{$flavor['name']} {$size['label']}",
                        'type' => ItemType::FINISHED_GOOD,
                        'base_uom_id' => $uomPcs->id,
                        'lot_tracked' => true,
                        'active' => true,
                    ]
                );

                $variant = ProductVariant::firstOrCreate(
                    ['sku' => $sku],
                    [
                        'product_id' => $product->id,
                        'inventory_item_id' => $item->id,
                        'variant_name' => "{$flavor['name']} {$size['label']}",
                        'net_content_quantity' => (string) $size['ml'],
                        'net_content_uom_id' => $uomMl->id,
                        'active' => true,
                    ]
                );

                $existingPrice = ProductVariantPrice::where('product_variant_id', $variant->id)
                    ->where('currency', 'IDR')
                    ->where('active', true)
                    ->first();

                if ($existingPrice === null) {
                    ProductVariantPrice::create([
                        'product_variant_id' => $variant->id,
                        'currency' => 'IDR',
                        'amount' => $size['price'],
                        'active' => true,
                    ]);
                } elseif ($existingPrice->amount !== $size['price']) {
                    $existingPrice->update(['active' => false]);
                    ProductVariantPrice::create([
                        'product_variant_id' => $variant->id,
                        'currency' => 'IDR',
                        'amount' => $size['price'],
                        'active' => true,
                    ]);
                }
            }
        }
    }
}
