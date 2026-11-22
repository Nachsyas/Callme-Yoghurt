<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Enums;

enum ReservationStatus: string
{
    case RESERVED = 'RESERVED';
    case RELEASED = 'RELEASED';
    case CONSUMED = 'CONSUMED';
    case EXPIRED = 'EXPIRED';
    case CANCELLED = 'CANCELLED';

    /**
     * Get all valid string values for validation.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
