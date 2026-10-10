<?php

declare(strict_types=1);

namespace App\Domain\Admin\Enums;

enum AdminStatus: string
{
    case ACTIVE = 'ACTIVE';
    case DISABLED = 'DISABLED';
}
