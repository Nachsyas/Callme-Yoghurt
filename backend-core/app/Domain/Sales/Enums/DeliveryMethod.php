<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum DeliveryMethod: string
{
    case INSTANT = 'instant';
    case SAMEDAY = 'sameday';
    case NEXTDAY = 'nextday';

    /**
     * Get all valid string values for request validation.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
