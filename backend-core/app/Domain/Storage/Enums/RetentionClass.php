<?php

declare(strict_types=1);

namespace App\Domain\Storage\Enums;

enum RetentionClass: string
{
    case HOT = 'HOT';
    case WARM = 'WARM';
    case COLD = 'COLD';
}
