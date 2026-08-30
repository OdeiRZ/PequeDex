# syntax=docker/dockerfile:1

# ---- PHP dependencies -------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
# The composer:2 image doesn't have the PHP extensions the app requires
# (pdo_pgsql, ...) - those are installed in the final stage below. Skip
# Composer's platform check here, since it would otherwise fail against
# this intermediate image rather than the real runtime.
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs

COPY . .
RUN composer dump-autoload --optimize --no-dev

# ---- Runtime ------------------------------------------------------------
# Single-process container (Laravel's built-in server) so the app can be
# deployed as-is on Render's free tier, which expects one container
# listening on $PORT rather than a separate nginx + php-fpm pair.
FROM php:8.3-cli-alpine AS app

WORKDIR /var/www/html

RUN apk add --no-cache postgresql-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql bcmath

# PHP's compiled-in defaults (upload_max_filesize=2M, post_max_size=8M)
# are smaller than what this app already validates against (milestone
# photos up to 8MB) - see docker/uploads.ini for why this file exists.
COPY docker/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

COPY --from=vendor /app/vendor ./vendor
COPY . .

RUN chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache database

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER www-data

ENV PORT=8080
ENV PHP_CLI_SERVER_WORKERS=4
EXPOSE 8080

ENTRYPOINT ["entrypoint.sh"]
CMD php artisan serve --host=0.0.0.0 --port=${PORT} --no-reload
