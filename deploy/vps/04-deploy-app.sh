#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — Application Deployment Script (Phase 1.5)
# Target Application: Laravel 13 ERP Core
# Location: /var/www/callme-erp
# ==============================================================================
set -euo pipefail

echo "====================================================="
echo " Callme Yoghurt — Phase 1.5 Application Deployment"
echo "====================================================="

APP_DIR="/var/www/callme-erp"
REPO_URL="https://github.com/Nachsyas/Callme-Yoghurt.git"
BRANCH="phase0/foundation-repair"

if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root (or via sudo)." >&2
   exit 1
fi

echo "[1/7] Ensuring target directory exists..."
mkdir -p "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "Cloning repository ($BRANCH)..."
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
else
    echo "Fetching latest changes ($BRANCH)..."
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
fi

cd "$APP_DIR/backend-core"

echo "[2/7] Checking production environment file..."
if [[ ! -f ".env" ]]; then
    if [[ -f "$APP_DIR/deploy/vps/.env.production.template" ]]; then
        cp "$APP_DIR/deploy/vps/.env.production.template" ".env"
        echo "Created .env from production template. YOU MUST FILL PRODUCTION SECRETS!"
    else
        echo "ERROR: .env file missing in backend-core! Create it before proceeding." >&2
        exit 1
    fi
fi

echo "[3/7] Setting directory ownership and permissions..."
chown -R www-data:www-data "$APP_DIR/backend-core/storage" "$APP_DIR/backend-core/bootstrap/cache"
chmod -R 775 "$APP_DIR/backend-core/storage" "$APP_DIR/backend-core/bootstrap/cache"

echo "[4/7] Installing Composer production dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

echo "[5/7] Executing database migrations..."
php artisan migrate --force

echo "[6/7] Linking storage and optimizing application caches..."
php artisan storage:link || true
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "[7/7] Restarting services..."
systemctl restart php8.3-fpm
systemctl restart nginx
supervisorctl reread || true
supervisorctl update || true
supervisorctl restart all || true

echo "====================================================="
echo " Application Deployment Complete!"
echo " Location: $APP_DIR/backend-core"
echo " Status: Optimized & Serving via PHP 8.3-FPM"
echo "====================================================="
