<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum OrderStatus: string
{
    case DRAFT = 'DRAFT';
    case CONFIRMED = 'CONFIRMED';
    case DONE = 'DONE';
    case CANCELLED = 'CANCELLED';
}
