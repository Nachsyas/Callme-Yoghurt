<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Exceptions;

use RuntimeException;

class ExpiredShippingQuoteException extends RuntimeException
{
    public function __construct(string $message = 'Kutipan ongkos kirim telah kedaluwarsa atau tidak ditemukan. Silakan hitung ulang ongkir.')
    {
        parent::__construct($message);
    }
}
