<?php

declare(strict_types=1);

namespace App\Domain\Manufacturing\Models;

use App\Domain\Inventory\Models\InventoryItem;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillOfMaterialComponent extends Model
{
    use HasUuids;

    protected $table = 'bill_of_material_components';

    protected $fillable = [
        'bill_of_material_id',
        'component_inventory_item_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:6',
        ];
    }

    public function billOfMaterial(): BelongsTo
    {
        return $this->belongsTo(BillOfMaterial::class, 'bill_of_material_id');
    }

    public function componentItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'component_inventory_item_id');
    }
}
