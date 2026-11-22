<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\CRM\Models\Customer;
use App\Domain\CRM\Services\PhoneBlindIndexService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class CustomerEncryptionTest extends TestCase
{
    /**
     * Verify that customer PII fields are cast to encrypted.
     */
    public function test_customer_pii_fields_are_encrypted(): void
    {
        $casts = (new Customer())->getCasts();

        $this->assertEquals('encrypted', $casts['name']);
        $this->assertEquals('encrypted', $casts['phone']);
        $this->assertEquals('encrypted', $casts['address']);
    }

    /**
     * Verify that sensitive PII fields are hidden from array/JSON serialization.
     */
    public function test_customer_pii_fields_are_hidden_from_serialization(): void
    {
        $customer = new Customer();
        $hidden = $customer->getHidden();

        $this->assertContains('name', $hidden);
        $this->assertContains('phone', $hidden);
        $this->assertContains('address', $hidden);
        $this->assertContains('phone_bindex', $hidden);
    }

    /**
     * Verify Indonesian phone normalization rule maps equivalent inputs to standard '62...'.
     */
    public function test_indonesian_phone_normalization_equivalent_inputs(): void
    {
        $expected = '628123456789';

        $this->assertEquals($expected, PhoneBlindIndexService::normalize('08123456789'));
        $this->assertEquals($expected, PhoneBlindIndexService::normalize('628123456789'));
        $this->assertEquals($expected, PhoneBlindIndexService::normalize('+628123456789'));
        $this->assertEquals($expected, PhoneBlindIndexService::normalize('+62 812-3456-789'));
        $this->assertEquals($expected, PhoneBlindIndexService::normalize('0812-3456-789'));
    }

    /**
     * Golden test vector verifying deterministic HMAC-SHA256 blind index.
     */
    public function test_phone_blind_index_golden_vector(): void
    {
        $testKey = 'test-crm-pii-blind-index-key-32ch';
        $rawPhone = '+62 812-3456-7890';
        $normalized = '6281234567890';

        $expectedHmac = hash_hmac('sha256', $normalized, $testKey);
        $actual = PhoneBlindIndexService::generateBlindIndex($rawPhone, $testKey);

        $this->assertEquals($expectedHmac, $actual);

        // Equivalent formats must produce the identical blind index
        $this->assertEquals($expectedHmac, PhoneBlindIndexService::generateBlindIndex('081234567890', $testKey));
        $this->assertEquals($expectedHmac, PhoneBlindIndexService::generateBlindIndex('6281234567890', $testKey));
    }

    /**
     * Verify that blind index generation fails closed when key is missing or empty.
     */
    public function test_phone_blind_index_fails_closed_without_key(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('CRM PII blind index key is not configured. Failing closed.');

        PhoneBlindIndexService::generateBlindIndex('08123456789', '');
    }
}
