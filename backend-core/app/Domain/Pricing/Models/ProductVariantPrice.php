<?php

declare(strict_types=1);

namespace App\Domain\Pricing\Models;

use App\Domain\Catalog\Models\ProductVariant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariantPrice extends Model
{
    use HasUuids;

    protected $table = 'product_variant_prices';

    protected $fillable = [
        'product_variant_id',
        'currency',
        'amount',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
