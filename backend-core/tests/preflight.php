<?php

declare(strict_types=1);

/**
 * Callme Yoghurt ERP Core — External Test Runner Preflight Auditor (Phase 1.7C.22A.2 Section 2)
 *
 * Executed BEFORE PHPUnit is launched.
 * Ensures:
 * 1. APP_ENV is strictly 'testing'.
 * 2. Database target is strictly 'callme_yoghurt_test' and never production.
 * 3. Database host target is internal/isolated (not production container or external URL).
 * 4. Verifies live PostgreSQL connectivity and verifies current_database() equals 'callme_yoghurt_test'.
 * 5. Fails closed with non-zero exit code on any anomaly.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/TestCase.php';

echo "==> [Callme ERP Test Preflight] Running pre-flight database safety audit...\n";

try {
    \Tests\TestCase::validatePreBootSafety();
    echo "==> [Callme ERP Test Preflight] Environment and host variables: VALIDATED.\n";

    $host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? 'postgres');
    $port = getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? '5432');
    $db = getenv('DB_DATABASE') ?: ($_ENV['DB_DATABASE'] ?? 'callme_yoghurt_test');
    $user = getenv('DB_USERNAME') ?: ($_ENV['DB_USERNAME'] ?? 'callme_test_user');
    $pass = getenv('DB_PASSWORD') ?: ($_ENV['DB_PASSWORD'] ?? 'callme_test_password_synthetic_only');

    $dsn = "pgsql:host={$host};port={$port};dbname={$db}";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 3,
    ]);

    $stmt = $pdo->query('SELECT current_database() as db');
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $activeDb = $row['db'] ?? '';

    if ($activeDb !== 'callme_yoghurt_test') {
        throw new RuntimeException("Preflight DB mismatch: Expected 'callme_yoghurt_test', got '{$activeDb}'.");
    }

    echo "==> [Callme ERP Test Preflight] Connected to live PostgreSQL test database: '{$activeDb}' on {$host}:{$port}.\n";
    echo "==> [Callme ERP Test Preflight] Dedicated isolated test stack confirmed. Preflight SUCCESS.\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "==> [Callme ERP Test Preflight] CRITICAL PREFLIGHT FAILURE: " . $e->getMessage() . "\n");
    exit(1);
}
