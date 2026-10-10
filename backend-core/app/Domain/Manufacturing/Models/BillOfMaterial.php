<?php

declare(strict_types=1);

namespace App\Domain\Manufacturing\Models;

use App\Domain\Inventory\Models\InventoryItem;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BillOfMaterial extends Model
{
    use HasUuids;

    protected $table = 'bills_of_materials';

    protected $fillable = [
        'code',
        'finished_inventory_item_id',
        'version',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function finishedItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'finished_inventory_item_id');
    }

    public function components(): HasMany
    {
        return $this->hasMany(BillOfMaterialComponent::class, 'bill_of_material_id');
    }
}
