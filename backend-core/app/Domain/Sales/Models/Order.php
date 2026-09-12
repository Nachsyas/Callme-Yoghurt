<?php

declare(strict_types=1);

namespace App\Domain\Sales\Models;

use App\Domain\CRM\Models\Customer;
use App\Domain\Sales\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasUuids;

    protected $table = 'orders';

    protected $fillable = [
        'order_number',
        'customer_id',
        'status',
        'total_amount',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'total_amount' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class, 'order_id');
    }
}
