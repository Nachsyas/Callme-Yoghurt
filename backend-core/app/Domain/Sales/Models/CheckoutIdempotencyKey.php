<?php

declare(strict_types=1);

namespace App\Domain\Sales\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CheckoutIdempotencyKey extends Model
{
    use HasUuids;

    protected $table = 'checkout_idempotency_keys';

    protected $fillable = [
        'scope',
        'key_hash',
        'request_hash',
        'order_id',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }
}
