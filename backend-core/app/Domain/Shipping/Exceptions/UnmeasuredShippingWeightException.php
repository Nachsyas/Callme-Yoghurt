<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Exceptions;

use RuntimeException;

class UnmeasuredShippingWeightException extends RuntimeException
{
    public function __construct(string $message = 'Berat pengiriman resmi belum ditimbang untuk satu atau lebih varian produk.')
    {
        parent::__construct($message);
    }
}
