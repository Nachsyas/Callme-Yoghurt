<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class OfficialCatalogSeeder extends Seeder
{
    /**
     * Seed authoritative catalog, variants, prices, warehouse, and FEFO lots.
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

        // 3. The 7 Official Flavors
        $officialFlavors = [
            [
                'slug' => 'plain',
                'name' => 'Plain Pure Original',
                'description' => 'Yogurt stirred murni tanpa tambahan gula dengan tekstur super kental, lembut, dan creamy kualitas homemade terbaik.',
            ],
            [
                'slug' => 'stroberi',
                'name' => 'Stroberi Summer Blush',
                'description' => 'Paduan rasa stroberi buah segar aromatik dengan yogurt kental premium dan tambahan topping jelly / nata de coco yang kenyal.',
            ],
            [
                'slug' => 'mangga',
                'name' => 'Mangga Tropical Gold',
                'description' => 'Yogurt lembut stirred premium dengan mangga harum manis masak pohon pilihan. Kaya probiotik hidup.',
            ],
            [
                'slug' => 'melon',
                'name' => 'Melon Emerald Fresh',
                'description' => 'Kesegaran melon hijau pilihan dengan aroma manis lembut menyejukkan. Sensasi dingin maksimal dari rantai dingin terjaga.',
            ],
            [
                'slug' => 'anggur',
                'name' => 'Anggur Royal Purple',
                'description' => 'Kombinasi anggur ungu pilihan yang manis legit dan sensasi asam segar khas yoghurt alami Callme.',
            ],
            [
                'slug' => 'leci',
                'name' => 'Leci Breeze Lychee',
                'description' => 'Aroma leci eksotis yang harum semerbak berpadu kelembutan stirred yoghurt segar.',
            ],
            [
                'slug' => 'vanila',
                'name' => 'Vanila Velvet Orchid',
                'description' => 'Kehangatan rasa vanila klasik berpadu kentalnya susu fermentasi dari peternakan lokal terbaik.',
            ],
        ];

        $sizes = [
            ['ml' => 250, 'price' => 15000, 'label' => '250ml'],
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

                ProductVariantPrice::firstOrCreate(
                    [
                        'product_variant_id' => $variant->id,
                        'currency' => 'IDR',
                    ],
                    [
                        'amount' => $size['price'],
                        'active' => true,
                    ]
                );

                // Create initial FEFO lot with 60 days shelf life (Cold Chain standard)
                $lotNumber = "LOT-" . strtoupper($flavor['slug']) . "-{$size['ml']}-001";
                $lot = InventoryLot::firstOrCreate(
                    [
                        'inventory_item_id' => $item->id,
                        'lot_number' => $lotNumber,
                    ],
                    [
                        'production_date' => Carbon::now('Asia/Jakarta')->subDays(2)->toDateString(),
                        'expiration_date' => Carbon::now('Asia/Jakarta')->addDays(60)->toDateString(),
                        'received_at' => Carbon::now('Asia/Jakarta')->subDays(2),
                    ]
                );

                // Add initial stock (100 units) to immutable ledger
                $hasLedger = StockLedgerEntry::where('inventory_item_id', $item->id)
                    ->where('warehouse_id', $warehouse->id)
                    ->where('inventory_lot_id', $lot->id)
                    ->exists();

                if (!$hasLedger) {
                    StockLedgerEntry::create([
                        'inventory_item_id' => $item->id,
                        'warehouse_id' => $warehouse->id,
                        'inventory_lot_id' => $lot->id,
                        'quantity_delta' => 100,
                        'event_type' => 'RECEIPT',
                        'reference_type' => 'INITIAL_STOCK',
                        'reference_id' => "INIT-WH-MAIN-{$sku}",
                        'occurred_at' => Carbon::now('Asia/Jakarta'),
                    ]);
                }
            }
        }
    }
}
