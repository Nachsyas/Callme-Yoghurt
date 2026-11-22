<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Exceptions;

use RuntimeException;

class InvalidShippingQuoteException extends RuntimeException
{
    public function __construct(string $message = 'Kutipan ongkos kirim tidak sesuai dengan keranjang belanja atau alamat tujuan.')
    {
        parent::__construct($message);
    }
}
