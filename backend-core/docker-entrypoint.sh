#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — Production Container Entrypoint
# Provider-Neutral Startup Orchestration
# Responsibilities:
# 1. Validate production configuration (centralized security check)
# 2. Wait for PostgreSQL readiness (if configured)
# 3. Controlled database migrations (opt-in via AUTO_MIGRATE=true)
# 4. Framework optimization caching (config, route, view, event)
# 5. Hand off execution to web server, queue worker, or passed command
# ==============================================================================
set -e

echo "==> [Callme ERP] Initializing container startup sequence..."

# 1. PostgreSQL Readiness Check (if DB_HOST or DB_URL is set)
DB_HOST="${DB_HOST:-}"
DB_URL="${DB_URL:-}"
if ( [ -n "$DB_HOST" ] || [ -n "$DB_URL" ] ) && [ "$SKIP_DB_WAIT" != "true" ]; then
    if [ -n "$DB_URL" ]; then
        DB_TARGET_LABEL=$(php -r '
            $url = getenv("DB_URL");
            $parts = parse_url($url);
            $host = $parts["host"] ?? "unknown";
            $port = $parts["port"] ?? 5432;
            $db   = isset($parts["path"]) ? ltrim($parts["path"], "/") : "default";
            echo "{$host}:{$port}/{$db}";
        ' 2>/dev/null || echo "DB_URL")
        echo "==> [Callme ERP] Waiting for PostgreSQL via DB_URL (${DB_TARGET_LABEL})..."
    else
        DB_PORT="${DB_PORT:-5432}"
        DB_NAME="${DB_DATABASE:-callme_yoghurt_prod}"
        echo "==> [Callme ERP] Waiting for PostgreSQL (${DB_HOST}:${DB_PORT}/${DB_NAME})..."
    fi

    MAX_TRIES=30
    COUNT=0

    until php -r '
        $url  = getenv("DB_URL");
        $host = getenv("DB_HOST");
        try {
            if (!empty($url)) {
                $parts = parse_url($url);
                if (!$parts || empty($parts["host"])) {
                    exit(1);
                }
                $host = $parts["host"];
                $port = $parts["port"] ?? 5432;
                $db   = isset($parts["path"]) ? ltrim($parts["path"], "/") : "";
                $user = isset($parts["user"]) ? urldecode($parts["user"]) : "";
                $pass = isset($parts["pass"]) ? urldecode($parts["pass"]) : "";
                $query = [];
                if (isset($parts["query"])) {
                    parse_str($parts["query"], $query);
                }
                $sslmode = $query["sslmode"] ?? (getenv("DB_SSLMODE") ?: "prefer");
                $dsn = "pgsql:host={$host};port={$port};dbname={$db};sslmode={$sslmode}";
                $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                $pdo->query("SELECT 1");
                exit(0);
            } elseif (!empty($host)) {
                $port = getenv("DB_PORT") ?: "5432";
                $db   = getenv("DB_DATABASE") ?: "callme_yoghurt_prod";
                $user = getenv("DB_USERNAME") ?: "callme_erp_user";
                $pass = getenv("DB_PASSWORD") ?: "";
                $sslmode = getenv("DB_SSLMODE") ?: "prefer";
                $dsn = "pgsql:host={$host};port={$port};dbname={$db};sslmode={$sslmode}";
                $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                $pdo->query("SELECT 1");
                exit(0);
            }
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
fi

# 2. Clear stale bootstrap caches & discover packages
rm -f /var/www/html/bootstrap/cache/packages.php \
      /var/www/html/bootstrap/cache/services.php \
      /var/www/html/bootstrap/cache/config.php \
      /var/www/html/bootstrap/cache/routes-*.php
php artisan package:discover --ansi

# 3. Security & Production Configuration Validation
if [ "${APP_ENV:-production}" = "production" ] || [ "${VALIDATE_CONFIG:-false}" = "true" ]; then
    echo "==> [Callme ERP] Running production configuration security audit..."
    php artisan callme:validate-production-config || {
        echo "==> [Callme ERP] CRITICAL: Configuration validation failed. Halting container." >&2
        exit 1
    }
fi

# 4. Controlled Database Migrations
# Strictly non-destructive. Never runs rollback/reset.
# Only executed when explicitly enabled via AUTO_MIGRATE=true or RUN_MIGRATIONS=true.
if [ "${AUTO_MIGRATE:-false}" = "true" ] || [ "${RUN_MIGRATIONS:-false}" = "true" ] || [ "$1" = "release" ]; then
    echo "==> [Callme ERP] Running database migrations (php artisan migrate --force)..."
    php artisan migrate --force
    if [ "$1" = "release" ]; then
        echo "==> [Callme ERP] Release migration command complete."
        exit 0
    fi
fi

# 5. Production Framework Optimization Caching
if [ "${APP_ENV:-production}" = "production" ]; then
    echo "==> [Callme ERP] Caching framework configurations, routes, events, and views (php artisan optimize)..."
    php artisan optimize || {
        echo "==> [Callme ERP] CRITICAL: Framework optimization (php artisan optimize) failed. Halting container." >&2
        exit 1
    }
fi

# 6. Ensure runtime storage permissions for www-data
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# 7. Start Services Based on Command Argument
TARGET_CMD="${1:-web}"
PORT="${PORT:-8000}"

if [ "$TARGET_CMD" = "web" ] || [ "$TARGET_CMD" = "serve" ]; then
    echo "==> [Callme ERP] Configuring Nginx to listen on port ${PORT}..."
    if [ -f /etc/nginx/http.d/default.conf ]; then
        sed -i "s/__PORT__/${PORT}/g" /etc/nginx/http.d/default.conf
    fi

    echo "==> [Callme ERP] Starting PHP-FPM daemon..."
    php-fpm -D

    echo "==> [Callme ERP] Starting Nginx web server on port ${PORT}..."
    exec nginx -g 'daemon off;'
elif [ "$TARGET_CMD" = "php-fpm" ]; then
    echo "==> [Callme ERP] Starting standalone PHP-FPM on port 9000..."
    exec php-fpm
else
    echo "==> [Callme ERP] Executing custom command: $@"
    exec "$@"
fi
