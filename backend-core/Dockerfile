# ==============================================================================
# Callme Yoghurt ERP Core — Production Multi-Stage Dockerfile
# Base: PHP 8.3-FPM (Alpine 3.20)
# Optimization: 1-2 vCPU, 2GB RAM Low-Cost VPS Profile
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

# Install production dependencies without dev packages or scripts
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts \
    --ignore-platform-reqs

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM php:8.3-fpm-alpine AS production

LABEL maintainer="Callme Yoghurt DevSecOps Team <ops@callmeyoghurt.com>"
LABEL service="erp-core"

WORKDIR /var/www/html

# Install extension installer
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install system dependencies and required PHP C-extensions
# Extensions: pdo_pgsql, pgsql, redis, bcmath, mbstring, xml, curl, zip, intl, gd, opcache
RUN apk update && apk add --no-cache \
    bash \
    curl \
    git \
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
    && rm -rf /var/cache/apk/* /tmp/*

# Copy PHP production & OPcache configurations
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom-php.ini
COPY docker/php/zz-docker.conf /usr/local/etc/php-fpm.d/zz-docker.conf

# Copy application source code
COPY . /var/www/html

# Copy vendor packages from builder stage
COPY --from=vendor-builder /app/vendor /var/www/html/vendor

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

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["php-fpm"]
