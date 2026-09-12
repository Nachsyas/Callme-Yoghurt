<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryLot extends Model
{
    use HasUuids;

    protected $table = 'inventory_lots';

    protected $fillable = [
        'inventory_item_id',
        'lot_number',
        'production_date',
        'expiration_date',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'production_date' => 'date',
            'expiration_date' => 'date',
            'received_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(StockLedgerEntry::class, 'inventory_lot_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(StockAllocation::class, 'inventory_lot_id');
    }
}
