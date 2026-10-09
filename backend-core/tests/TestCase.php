<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Set up the test environment with fail-closed safety guards (Phase 1.7C.22A.1 Section 10).
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Fail-closed environment isolation check
        $env = (string) config('app.env');
        $dbName = (string) config('database.connections.pgsql.database');

        if ($env !== 'testing') {
            throw new \RuntimeException(
                "SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing. Current APP_ENV='{$env}'."
            );
        }

        if ($dbName === 'callme_yoghurt_prod' || str_contains(strtolower($dbName), 'prod')) {
            throw new \RuntimeException(
                "SAFETY VIOLATION: Backend tests must NEVER connect to a production database ('{$dbName}')."
            );
        }
    }
}
