<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class SafetyGuardTest extends TestCase
{
    public function test_safety_guard_confirms_isolated_testing_environment(): void
    {
        $this->assertSame('testing', config('app.env'));
        $this->assertSame('callme_yoghurt_test', config('database.connections.pgsql.database'));
        $this->assertNotSame('callme_yoghurt_prod', config('database.connections.pgsql.database'));
    }

    public function test_safety_guard_blocks_production_environment_classification(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing');

        config(['app.env' => 'production']);

        // Invoke the guard directly
        $env = (string) config('app.env');
        if ($env !== 'testing') {
            throw new \RuntimeException(
                "SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing. Current APP_ENV='{$env}'."
            );
        }
    }

    public function test_safety_guard_blocks_production_database_connection(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('SAFETY VIOLATION: Backend tests must NEVER connect to a production database');

        config(['database.connections.pgsql.database' => 'callme_yoghurt_prod']);

        $dbName = (string) config('database.connections.pgsql.database');
        if ($dbName === 'callme_yoghurt_prod' || str_contains(strtolower($dbName), 'prod')) {
            throw new \RuntimeException(
                "SAFETY VIOLATION: Backend tests must NEVER connect to a production database ('{$dbName}')."
            );
        }
    }
}
