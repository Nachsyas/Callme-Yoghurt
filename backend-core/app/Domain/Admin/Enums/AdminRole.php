<?php

declare(strict_types=1);

namespace App\Domain\Admin\Enums;

enum AdminRole: string
{
    case OWNER = 'OWNER';
    case ADMIN = 'ADMIN';
}
