<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class StockLedgerEntry extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'stock_ledger_entries';

    protected $fillable = [
        'inventory_item_id',
        'warehouse_id',
        'inventory_lot_id',
        'quantity_delta',
        'event_type',
        'reference_type',
        'reference_id',
        'correlation_id',
        'occurred_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity_delta' => 'decimal:6',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (StockLedgerEntry $entry) {
            if ($entry->quantity_delta === null || (float) $entry->quantity_delta == 0.0) {
                throw new RuntimeException('Stock ledger entry quantity_delta cannot be zero.');
            }
            if ($entry->occurred_at === null) {
                $entry->occurred_at = now();
            }
            if ($entry->created_at === null) {
                $entry->created_at = now();
            }
        });

        static::updating(function () {
            throw new RuntimeException('Stock ledger entries are immutable and cannot be updated.');
        });

        static::deleting(function () {
            throw new RuntimeException('Stock ledger entries are immutable and cannot be deleted.');
        });
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(InventoryLot::class, 'inventory_lot_id');
    }
}
