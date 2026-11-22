<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Exceptions;

use RuntimeException;

class UnconfiguredServiceFeeException extends RuntimeException
{
    public function __construct(string $message = 'BLOCKED — OWNER FEE VALUE REQUIRED')
    {
        parent::__construct($message);
    }
}
