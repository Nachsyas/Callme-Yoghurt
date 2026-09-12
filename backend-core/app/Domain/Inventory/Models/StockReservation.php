<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockReservation extends Model
{
    use HasUuids;

    protected $table = 'stock_reservations';

    protected $fillable = [
        'inventory_item_id',
        'warehouse_id',
        'reference_type',
        'reference_id',
        'quantity',
        'status',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:6',
            'expires_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(StockAllocation::class, 'stock_reservation_id');
    }
}
