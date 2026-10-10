<?php

declare(strict_types=1);

namespace App\Domain\Storage\Enums;

use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Sales\Models\Order;

enum AttachmentOwnerType: string
{
    case PRODUCT_VARIANT = 'PRODUCT_VARIANT';
    case ORDER = 'ORDER';

    /**
     * Resolve the corresponding Eloquent model class for this owner type.
     *
     * @return class-string
     */
    public function modelClass(): string
    {
        return match ($this) {
            self::PRODUCT_VARIANT => ProductVariant::class,
            self::ORDER => Order::class,
        };
    }
}
