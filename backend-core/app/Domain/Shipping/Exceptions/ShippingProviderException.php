<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Exceptions;

use RuntimeException;
use Throwable;

class ShippingProviderException extends RuntimeException
{
    public function __construct(string $message = 'Layanan penyedia tarif logistik mengalami gangguan.', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
