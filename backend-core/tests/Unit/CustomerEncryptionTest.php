<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Domain\CRM\Models\Customer;

class CustomerEncryptionTest extends TestCase
{
    /**
     * A basic unit test to verify that the customer model casts to encrypted.
     */
    public function test_customer_pii_fields_are_encrypted(): void
    {
        $casts = (new Customer())->getCasts();
        
        $this->assertEquals('encrypted', $casts['name']);
        $this->assertEquals('encrypted', $casts['phone']);
        $this->assertEquals('encrypted', $casts['address']);
    }
}
