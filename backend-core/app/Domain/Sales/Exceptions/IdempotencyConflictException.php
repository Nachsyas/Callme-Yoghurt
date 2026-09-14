<?php

declare(strict_types=1);

namespace App\Domain\Sales\Exceptions;

use RuntimeException;

class IdempotencyConflictException extends RuntimeException
{
}
