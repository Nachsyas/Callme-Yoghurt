<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Models;

use App\Domain\Inventory\Enums\ItemType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use HasUuids;

    protected $table = 'inventory_items';

    protected $fillable = [
        'code',
        'name',
        'type',
        'base_uom_id',
        'lot_tracked',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'type' => ItemType::class,
            'lot_tracked' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function baseUom(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'base_uom_id');
    }

    public function lots(): HasMany
    {
        return $this->hasMany(InventoryLot::class, 'inventory_item_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(StockLedgerEntry::class, 'inventory_item_id');
    }
}
