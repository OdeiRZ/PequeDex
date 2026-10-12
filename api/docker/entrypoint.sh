#!/bin/sh
set -e

php artisan migrate --force

# Cachés de configuración, rutas, eventos y vistas: Laravel no las
# reconstruye en cada petición. Se hace aquí y no al construir la imagen
# porque la configuración lee las variables de entorno de Render, que solo
# existen al arrancar. Si algo impidiera cachearlas, la app arranca igual,
# solo que sin esa mejora.
php artisan optimize || echo "optimize falló: se sigue sin cachés"

exec "$@"
