<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UnitOfMeasure extends Model
{
    use HasUuids;

    protected $table = 'units_of_measure';

    protected $fillable = [
        'code',
        'name',
        'category',
    ];

    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class, 'base_uom_id');
    }
}
