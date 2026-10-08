# ==============================================================================
# Callme Yoghurt ERP Core — Production Multi-Stage Dockerfile
# Base: PHP 8.3-FPM (Alpine 3.20) + Lightweight Standalone Nginx Web Server
# Provider-Neutral Architecture: Low-Cost VPS, Cloud Run, Fly.io, Railway, Render
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Vendor Builder (Composer)
# ------------------------------------------------------------------------------
FROM composer:2.8 AS vendor-builder

WORKDIR /app

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_PROCESS_TIMEOUT=2000 \
    COMPOSER_MAX_PARALLEL_HTTP=4

# Copy dependency definition files
COPY composer.json composer.lock ./

# Install production dependencies deterministically using lock file
# Excludes dev packages, no scripts executed, optimized classmap autoloader
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM php:8.3-fpm-alpine AS production

LABEL maintainer="Callme Yoghurt DevSecOps Team <ops@callmeyoghurt.com>"
LABEL service="erp-core"

WORKDIR /var/www/html

# Install extension installer
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install system utilities, lightweight Nginx web server, and PHP extensions
# Extensions: pdo_pgsql, pgsql, redis, bcmath, mbstring, xml, curl, zip, intl, gd, opcache, pcntl, posix
RUN apk update && apk add --no-cache \
    bash \
    curl \
    git \
    nginx \
    postgresql-client \
    su-exec \
    && install-php-extensions \
    pdo_pgsql \
    pgsql \
    redis \
    bcmath \
    mbstring \
    xml \
    curl \
    zip \
    intl \
    gd \
    opcache \
    pcntl \
    posix \
    && rm -rf /var/cache/apk/* /tmp/*

# Configure Nginx and PHP directories
RUN mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx \
    && chown -R www-data:www-data /var/log/nginx /var/lib/nginx /run/nginx

# Copy PHP production & OPcache configurations
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom-php.ini
COPY docker/php/zz-docker.conf /usr/local/etc/php-fpm.d/zz-docker.conf

# Copy standalone Nginx web configuration
COPY docker/nginx/nginx-standalone.conf /etc/nginx/http.d/default.conf

# Copy application source code
COPY . /var/www/html

# Copy vendor packages from builder stage
COPY --from=vendor-builder /app/vendor /var/www/html/vendor

# Copy Composer binary to run strict platform requirement validation
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Authoritative Composer Platform Verification:
# Proves that PHP and all required extensions strictly satisfy the locked dependency graph.
# Build MUST fail if any platform requirement is missing.
RUN composer check-platform-reqs --no-dev \
    && rm -f /usr/bin/composer

# Copy and setup entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure storage and bootstrap directories exist with proper permissions
RUN mkdir -p /var/www/html/storage/framework/cache \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/logs \
    /var/www/html/bootstrap/cache \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Expose HTTP port (8000 default) and FastCGI port (9000)
EXPOSE 8000 9000

# Healthcheck checking /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
