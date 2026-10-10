<?php

declare(strict_types=1);

namespace App\Domain\Storage\Enums;

enum DataClassification: string
{
    case PUBLIC = 'PUBLIC';
    case INTERNAL = 'INTERNAL';
    case CONFIDENTIAL = 'CONFIDENTIAL';
    case RESTRICTED = 'RESTRICTED';
}
