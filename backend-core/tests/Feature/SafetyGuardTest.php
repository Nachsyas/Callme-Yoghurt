<?php

declare(strict_types=1);

namespace Tests\Feature;

use RuntimeException;
use Tests\TestCase;

class SafetyGuardTest extends TestCase
{
    public function test_safety_guard_confirms_isolated_testing_environment(): void
    {
        $this->assertSame('testing', config('app.env'));
        $this->assertSame('callme_yoghurt_test', config('database.connections.pgsql.database'));
        $this->assertNotSame('callme_yoghurt_prod', config('database.connections.pgsql.database'));

        // Proves authoritative validator passes on valid test configuration
        TestCase::validateDatabaseTargetSafety(
            'testing',
            'callme_yoghurt_test',
            'postgres'
        );
    }

    public function test_safety_guard_blocks_production_environment_classification(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing');

        TestCase::validateDatabaseTargetSafety(
            'production',
            'callme_yoghurt_test',
            'postgres'
        );
    }

    public function test_safety_guard_blocks_staging_environment_classification(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing');

        TestCase::validateDatabaseTargetSafety(
            'staging',
            'callme_yoghurt_test',
            'postgres'
        );
    }

    public function test_safety_guard_blocks_production_database_connection(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must NEVER connect to a production database');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            'callme_yoghurt_prod',
            'postgres'
        );
    }

    public function test_safety_guard_blocks_any_database_containing_prod(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must NEVER connect to a production database');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            'my_custom_prod_db',
            'postgres'
        );
    }

    public function test_safety_guard_blocks_production_container_hostname(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Database host points to production container');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            'callme_yoghurt_test',
            'callme_erp_postgres'
        );
    }

    public function test_safety_guard_blocks_external_database_endpoints(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Unexpected external database host endpoint');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            'callme_yoghurt_test',
            'db.production.callmeyoghurt.com'
        );
    }

    public function test_safety_guard_fails_closed_when_database_name_is_empty(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Database name target cannot be established. Failing closed.');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            '',
            'postgres'
        );
    }

    public function test_safety_guard_fails_closed_when_database_host_is_empty(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Database host target cannot be established. Failing closed.');

        TestCase::validateDatabaseTargetSafety(
            'testing',
            'callme_yoghurt_test',
            ''
        );
    }
}
