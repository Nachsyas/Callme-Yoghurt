<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Models;

use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariant extends Model
{
    use HasUuids;

    protected $table = 'product_variants';

    protected $fillable = [
        'product_id',
        'inventory_item_id',
        'sku',
        'variant_name',
        'net_content_quantity',
        'net_content_uom_id',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'net_content_quantity' => 'decimal:6',
            'active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function netContentUom(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'net_content_uom_id');
    }
}
