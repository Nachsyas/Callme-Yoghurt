<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

abstract class TestCase extends BaseTestCase
{
    /**
     * Permitted database host targets for isolated test execution.
     */
    private const ALLOWED_TEST_HOSTS = [
        'postgres',
        '127.0.0.1',
        'localhost',
        '::1',
    ];

    /**
     * Override createApplication to enforce pre-flight and post-bootstrap safety guards
     * BEFORE any trait setups or framework data mutations can execute.
     */
    public function createApplication()
    {
        // 1. External / Pre-bootstrap preflight check (Phase 1.7C.22A.2 Section 2)
        self::validatePreBootSafety();

        $app = parent::createApplication();

        // 2. Post-bootstrap framework configuration safety guard
        self::validateApplicationSafety($app);

        return $app;
    }

    /**
     * Set up the test environment with fail-closed safety guards.
     */
    protected function setUp(): void
    {
        // 3. Pre-flight check before parent::setUp()
        self::validatePreFlightSafety();

        parent::setUp();

        // 4. Runtime live database connection target verification
        self::validateRuntimeSafety();
    }

    /**
     * Pre-boot safety audit reading raw environment variables before framework boots.
     */
    public static function validatePreBootSafety(): void
    {
        $env = getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? ($_SERVER['APP_ENV'] ?? 'testing'));
        $db = getenv('DB_DATABASE') ?: ($_ENV['DB_DATABASE'] ?? ($_SERVER['DB_DATABASE'] ?? 'callme_yoghurt_test'));
        $host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? ($_SERVER['DB_HOST'] ?? 'postgres'));

        self::validateDatabaseTargetSafety(
            is_string($env) ? $env : null,
            is_string($db) ? $db : null,
            is_string($host) ? $host : null
        );
    }

    /**
     * Post-bootstrap safety audit verifying Laravel's resolved configuration.
     */
    public static function validateApplicationSafety($app): void
    {
        $env = (string) $app['config']->get('app.env');
        $db = (string) $app['config']->get('database.connections.pgsql.database');
        $host = (string) $app['config']->get('database.connections.pgsql.host');

        self::validateDatabaseTargetSafety($env, $db, $host);
    }

    /**
     * Pre-setup check executed immediately before parent::setUp().
     * Uses environment variables rather than container binding since container is not booted yet.
     */
    public static function validatePreFlightSafety(): void
    {
        self::validatePreBootSafety();
    }

    /**
     * Runtime check validating live PostgreSQL connection target.
     */
    public static function validateRuntimeSafety(): void
    {
        try {
            $result = DB::connection()->selectOne('SELECT current_database() as db');
            $currentDb = (string) ($result->db ?? '');

            if ($currentDb !== 'callme_yoghurt_test' && !str_ends_with($currentDb, '_test')) {
                throw new RuntimeException(
                    "SAFETY VIOLATION: Live connected database is '{$currentDb}'. Testing must strictly use 'callme_yoghurt_test'."
                );
            }

            if (str_contains(strtolower($currentDb), 'prod')) {
                throw new RuntimeException(
                    "SAFETY VIOLATION: Live connected database '{$currentDb}' contains production marker."
                );
            }
        } catch (Throwable $e) {
            if ($e instanceof RuntimeException && str_starts_with($e->getMessage(), 'SAFETY VIOLATION:')) {
                throw $e;
            }
            throw new RuntimeException(
                "SAFETY VIOLATION: Could not establish live database target: " . $e->getMessage(),
                0,
                $e
            );
        }
    }

    /**
     * Authoritative database pre-flight and environment isolation validator.
     *
     * Invariants (Phase 1.7C.22A.2 Section 2):
     * 1. APP_ENV must be strictly 'testing'.
     * 2. Database name must be non-empty, must not contain 'prod', and must match test database.
     * 3. Database host must be non-empty, must not point to production container, external domains, or remote IPs.
     * 4. Docker project identity must be isolated ('callme_test') if specified.
     * 5. Fails closed when targets cannot be established.
     */
    public static function validateDatabaseTargetSafety(?string $env, ?string $dbName, ?string $dbHost): void
    {
        // 1. Verify APP_ENV
        if ($env === null || trim($env) === '') {
            throw new RuntimeException(
                "SAFETY VIOLATION: APP_ENV is undefined or empty. Failing closed."
            );
        }

        if ($env !== 'testing') {
            throw new RuntimeException(
                "SAFETY VIOLATION: Backend tests must strictly execute with APP_ENV=testing. Current APP_ENV='{$env}'."
            );
        }

        // 2. Verify Database Name
        if ($dbName === null || trim($dbName) === '') {
            throw new RuntimeException(
                "SAFETY VIOLATION: Database name target cannot be established. Failing closed."
            );
        }

        $cleanDbName = strtolower(trim($dbName));
        if ($cleanDbName === 'callme_yoghurt_prod' || str_contains($cleanDbName, 'prod')) {
            throw new RuntimeException(
                "SAFETY VIOLATION: Backend tests must NEVER connect to a production database ('{$dbName}')."
            );
        }

        if ($cleanDbName !== 'callme_yoghurt_test' && !str_ends_with($cleanDbName, '_test')) {
            throw new RuntimeException(
                "SAFETY VIOLATION: Database name '{$dbName}' is not a designated testing database ('callme_yoghurt_test')."
            );
        }

        // 3. Verify Database Host
        if ($dbHost === null || trim($dbHost) === '') {
            throw new RuntimeException(
                "SAFETY VIOLATION: Database host target cannot be established. Failing closed."
            );
        }

        $cleanHost = strtolower(trim($dbHost));
        if ($cleanHost === 'callme_erp_postgres' || str_contains($cleanHost, 'callme_erp_postgres')) {
            throw new RuntimeException(
                "SAFETY VIOLATION: Database host points to production container '{$dbHost}'. Failing closed."
            );
        }

        if (
            str_contains($cleanHost, '.com') ||
            str_contains($cleanHost, '.net') ||
            str_contains($cleanHost, '.org') ||
            str_contains($cleanHost, '.rds.') ||
            str_contains($cleanHost, '.internal')
        ) {
            throw new RuntimeException(
                "SAFETY VIOLATION: Unexpected external database host endpoint '{$dbHost}'. Testing must use isolated local/docker test database."
            );
        }

        if (!in_array($cleanHost, self::ALLOWED_TEST_HOSTS, true)) {
            throw new RuntimeException(
                "SAFETY VIOLATION: Unauthorized database host '{$dbHost}'. Permitted test hosts: " . implode(', ', self::ALLOWED_TEST_HOSTS) . "."
            );
        }

        // 4. Verify Docker project identity (if set)
        $dockerProject = getenv('COMPOSE_PROJECT_NAME') ?: ($_ENV['COMPOSE_PROJECT_NAME'] ?? null);
        if ($dockerProject !== null && trim($dockerProject) !== '' && trim($dockerProject) !== 'callme_test') {
            throw new RuntimeException(
                "SAFETY VIOLATION: Docker project identity '{$dockerProject}' is not the isolated test project 'callme_test'."
            );
        }
    }
}
