#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — Container Entrypoint Script
# Responsibilities:
# 1. Wait for PostgreSQL readiness
# 2. Execute migrations (php artisan migrate --force)
# 3. Cache configuration, routes, and views
# 4. Hand off execution to passed command (php-fpm or queue:work)
# ==============================================================================
set -e

echo "==> [Callme ERP] Starting container entrypoint sequence..."

# 1. Wait for PostgreSQL database readiness
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_DATABASE:-callme_yoghurt_prod}"
DB_USER="${DB_USERNAME:-callme_erp_user}"

echo "==> [Callme ERP] Waiting for PostgreSQL (${DB_HOST}:${DB_PORT}/${DB_NAME})..."

MAX_TRIES=60
COUNT=0

until php -r '
    $host = getenv("DB_HOST") ?: "postgres";
    $port = getenv("DB_PORT") ?: "5432";
    $db   = getenv("DB_DATABASE") ?: "callme_yoghurt_prod";
    $user = getenv("DB_USERNAME") ?: "callme_erp_user";
    $pass = getenv("DB_PASSWORD") ?: "";
    try {
        $pdo = new PDO("pgsql:host={$host};port={$port};dbname={$db}", $user, $pass, [PDO::ATTR_TIMEOUT => 2]);
        exit(0);
    } catch (Throwable $e) {
        exit(1);
    }
' 2>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_TRIES" ]; then
        echo "==> [Callme ERP] ERROR: PostgreSQL was not reachable within ${MAX_TRIES} attempts. Failing closed." >&2
        exit 1
    fi
    sleep 2
done

echo "==> [Callme ERP] PostgreSQL is ready and accepting connections."

# Clear any stale host cache and discover production packages
rm -f /var/www/html/bootstrap/cache/packages.php /var/www/html/bootstrap/cache/services.php /var/www/html/bootstrap/cache/config.php
php artisan package:discover --ansi || true

# 2. Run migrations only if running the web application (or if explicitly enabled)
# This prevents race conditions between the web container and worker container.
if [ "$1" = "php-fpm" ] || [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "==> [Callme ERP] Running database migrations..."
    php artisan migrate --force
fi

# 3. Cache framework configuration for production performance
if [ "${APP_ENV:-production}" = "production" ]; then
    echo "==> [Callme ERP] Caching framework configurations..."
    php artisan config:cache || true
    php artisan route:cache || true
    if [ -d "/var/www/html/resources/views" ]; then
        php artisan view:cache || true
    fi
    php artisan event:cache || true
fi

# 4. Guarantee runtime storage permissions for www-data
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

echo "==> [Callme ERP] Entrypoint sequence complete. Launching: $@"
exec "$@"
