#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — Server Stack Installation Script (Phase 1.5)
# Stack: PHP 8.3-FPM, PostgreSQL 16, Redis 7, Nginx, Composer, Supervisor
# ==============================================================================
set -euo pipefail

echo "====================================================="
echo " Callme Yoghurt — Phase 1.5 Server Stack Installation"
echo "====================================================="

if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root (or via sudo)." >&2
   exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[1/6] Adding Ondrej PHP Repository (PHP 8.3)..."
apt-get install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update -y

echo "[2/6] Installing PHP 8.3-FPM and required extensions..."
apt-get install -y \
    php8.3-fpm \
    php8.3-cli \
    php8.3-common \
    php8.3-pgsql \
    php8.3-mbstring \
    php8.3-xml \
    php8.3-bcmath \
    php8.3-curl \
    php8.3-zip \
    php8.3-intl \
    php8.3-redis \
    php8.3-gd \
    php8.3-opcache \
    unzip

# Tune PHP 8.3-FPM for production
PHP_FPM_INI="/etc/php/8.3/fpm/php.ini"
sed -i 's/upload_max_filesize = .*/upload_max_filesize = 32M/' "$PHP_FPM_INI"
sed -i 's/post_max_size = .*/post_max_size = 32M/' "$PHP_FPM_INI"
sed -i 's/memory_limit = .*/memory_limit = 512M/' "$PHP_FPM_INI"
sed -i 's/max_execution_time = .*/max_execution_time = 60/' "$PHP_FPM_INI"
sed -i 's/;opcache.enable=1/opcache.enable=1/' "$PHP_FPM_INI"
sed -i 's/;opcache.memory_consumption=128/opcache.memory_consumption=256/' "$PHP_FPM_INI"
sed -i 's/;opcache.max_accelerated_files=10000/opcache.max_accelerated_files=20000/' "$PHP_FPM_INI"
sed -i 's/;opcache.validate_timestamps=1/opcache.validate_timestamps=0/' "$PHP_FPM_INI"

systemctl enable php8.3-fpm
systemctl restart php8.3-fpm

echo "[3/6] Installing Composer..."
if ! command -v composer > /dev/null 2>&1; then
    EXPECTED_CHECKSUM="$(php -r 'copy("https://composer.github.io/installer.sig", "php://stdout");')"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"

    if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
        >&2 echo 'ERROR: Invalid Composer installer checksum'
        rm composer-setup.php
        exit 1
    fi

    php composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
    rm composer-setup.php
    echo "Composer installed successfully."
else
    echo "Composer already installed."
fi

echo "[4/6] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl restart nginx

echo "[5/6] Installing PostgreSQL 16..."
# Add PostgreSQL Official Repository
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update -y
apt-get install -y postgresql-16 postgresql-contrib-16

systemctl enable postgresql
systemctl restart postgresql

echo "[6/6] Installing Redis 7 & Supervisor..."
apt-get install -y redis-server supervisor

# Secure Redis: bind to localhost only, enable append-only file (AOF)
REDIS_CONF="/etc/redis/redis.conf"
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"
sed -i 's/^appendonly no/appendonly yes/' "$REDIS_CONF"

systemctl enable redis-server
systemctl restart redis-server

systemctl enable supervisor
systemctl restart supervisor

echo "====================================================="
echo " Verifying Component Installations:"
echo "-----------------------------------------------------"
php -v | head -n 1
composer -V
nginx -v
psql --version
redis-cli ping
echo "====================================================="
echo " Server Stack Installation Complete!"
echo "====================================================="
