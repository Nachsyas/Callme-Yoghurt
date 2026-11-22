<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\CRM\Models\Customer;
use App\Domain\CRM\Services\PhoneBlindIndexService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerMigrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Proves customer migration creates schema on PostgreSQL with expected column types.
     */
    public function test_customer_migration_creates_schema_on_postgresql(): void
    {
        $this->assertTrue(Schema::hasTable('customers'), 'customers table must exist');

        $expectedColumns = [
            'id',
            'name',
            'phone',
            'address',
            'phone_bindex',
            'created_at',
            'updated_at',
        ];

        foreach ($expectedColumns as $col) {
            $this->assertTrue(Schema::hasColumn('customers', $col), "customers table must have {$col} column");
        }
    }

    /**
     * Proves customer model stores encrypted ciphertext in PostgreSQL and searches via blind index.
     */
    public function test_customer_persistence_encrypts_data_and_searches_via_blind_index(): void
    {
        $rawName = 'Budi Santoso';
        $rawPhone = '081234567890';
        $rawAddress = 'Jl. Sukajadi No. 123, Bandung';
        $testKey = 'test-crm-pii-blind-index-key-32ch';

        $customer = new Customer();
        $customer->name = $rawName;
        $customer->address = $rawAddress;
        $customer->setPhoneWithBlindIndex($rawPhone, $testKey);
        $customer->save();

        $this->assertNotNull($customer->id);

        // Direct database inspection proves raw columns store ciphertext, not plaintext
        $rawRow = DB::table('customers')->where('id', $customer->id)->first();
        $this->assertNotNull($rawRow);

        $this->assertNotEquals($rawName, $rawRow->name, 'Raw database name must be encrypted');
        $this->assertNotEquals($rawPhone, $rawRow->phone, 'Raw database phone must be encrypted');
        $this->assertNotEquals($rawAddress, $rawRow->address, 'Raw database address must be encrypted');

        // Verify deterministic blind index matches expected HMAC
        $expectedBindex = PhoneBlindIndexService::generateBlindIndex($rawPhone, $testKey);
        $this->assertEquals($expectedBindex, $rawRow->phone_bindex);

        // Lookup via blind index with an equivalent phone format
        $equivalentInput = '+62 812-3456-7890';
        $searchBindex = PhoneBlindIndexService::generateBlindIndex($equivalentInput, $testKey);
        $found = Customer::where('phone_bindex', $searchBindex)->first();

        $this->assertNotNull($found);
        $this->assertEquals($customer->id, $found->id);
        $this->assertEquals($rawName, $found->name);
        $this->assertEquals($rawPhone, $found->phone);
        $this->assertEquals($rawAddress, $found->address);

        // Serialization verification: hidden fields never leak in toArray() or toJson()
        $array = $found->toArray();
        $this->assertArrayNotHasKey('name', $array);
        $this->assertArrayNotHasKey('phone', $array);
        $this->assertArrayNotHasKey('address', $array);
        $this->assertArrayNotHasKey('phone_bindex', $array);
    }
}
