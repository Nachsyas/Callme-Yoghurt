<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Enums;

enum ItemType: string
{
    case RAW_MATERIAL = 'RAW_MATERIAL';
    case PACKAGING = 'PACKAGING';
    case FINISHED_GOOD = 'FINISHED_GOOD';
}
