<?php

declare(strict_types=1);

namespace App\Domain\Sales\Models;

use App\Domain\CRM\Models\Customer;
use App\Domain\Sales\Enums\DeliveryMethod;
use App\Domain\Sales\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasUuids;

    protected $table = 'orders';

    protected $fillable = [
        'order_number',
        'customer_id',
        'shipping_name',
        'shipping_phone',
        'shipping_address',
        'delivery_method',
        'status',
        'total_amount',
    ];

    /**
     * Attributes hidden from array/JSON serialization.
     * Shipping snapshot and delivery details are internal transaction history
     * and must never be leaked to public API responses.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'shipping_name',
        'shipping_phone',
        'shipping_address',
        'delivery_method',
    ];

    protected function casts(): array
    {
        return [
            'shipping_name' => 'encrypted',
            'shipping_phone' => 'encrypted',
            'shipping_address' => 'encrypted',
            'delivery_method' => DeliveryMethod::class,
            'status' => OrderStatus::class,
            'total_amount' => 'integer',
        ];
    }

    /**
     * Generate an explicit collision-resistant order number: CY-YYYYMMDD-<ULID>
     */
    public static function generateOrderNumber(): string
    {
        return 'CY-' . date('Ymd') . '-' . strtoupper((string) Str::ulid());
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
