# PequeDex API

API REST en Laravel 12 para [PequeDex](../README.md). Autenticación por
token (Sanctum Personal Access Tokens) — ver la nota de arquitectura en el
README raíz para el porqué.

## Instalación

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite   # desarrollo: SQLite; producción: Postgres
php artisan migrate
php artisan storage:link         # necesario para servir las fotos de los hitos
php artisan serve
```

Si `php artisan serve` se levanta en un puerto distinto al de `APP_URL`
en `.env` (por ejemplo, con `--port`), actualiza `APP_URL` a juego — la
URL de la foto de un hito (`photo_url`) se construye a partir de ese
valor, así que un `APP_URL` desajustado hace que la imagen no cargue
aunque el archivo exista.

## Scripts

```bash
php artisan test     # Pest
vendor/bin/pint       # formateo de código
vendor/bin/phpstan analyse   # análisis estático (Larastan, nivel 5)
```

## Estructura relevante

- `app/Http/Controllers/Auth/AuthController.php` — registro, login y
  logout. Cada sesión es un Sanctum Personal Access Token con nombre fijo
  (`'PequeDex'`), no un campo `device_name` enviado por el cliente — no
  hay ninguna pantalla que muestre "sesiones activas por dispositivo" que
  lo necesite.
- `bootstrap/app.php` / `app/Providers/AppServiceProvider.php` — la API no
  tiene ninguna ruta `web` con nombre `login` (es una API pura), así que el
  manejo por defecto de Laravel para una petición no autenticada sin
  cabecera `Accept: application/json` (redirigir a `route('login')`) revienta
  con un 500 en vez de devolver un 401 limpio. Corregido en dos sitios a la
  vez (hace falta los dos): `Authenticate::redirectUsing(fn () => null)` y
  un `render()` explícito para `AuthenticationException` en
  `withExceptions()`.
- `lang/es` / `lang/en` — mensajes de validación y autenticación en
  español (idioma por defecto, `APP_LOCALE=es`) con inglés como fallback.
- `app/Models/Baby.php` / `app/Policies/BabyPolicy.php` — el recurso
  compartido entre cuidadores (tabla pivote `baby_user`, sin distinción
  admin/no-admin: cualquier cuidador vinculado tiene acceso total de
  lectura/escritura). `FeedController`/`SleepController`/
  `DiaperChangeController` autorizan siempre contra el `Baby` padre
  (`$this->authorize('update', $baby)`), nunca contra el `user_id` de la
  fila que se está editando — el campo `user_id` en `feeds`/`sleeps`/
  `diaper_changes` es solo trazabilidad de quién lo registró, nunca se
  usa para decidir quién puede verlo o editarlo.
- `Baby::generateInviteCode()` — código de 8 caracteres sin `0`/`O`/`1`/`I`
  (se escriben/leen a mano, esos pares se confunden fácilmente), con
  comprobación de colisión real en vez de asumir que el espacio de
  claves (32⁸) es suficientemente grande.
- `TimelineController` — mezcla tomas/sueño/pañales en una sola lista
  ordenada en PHP, no con un `UNION` SQL entre tres tablas de forma
  distinta: el registro de una familia no alcanza un volumen (ni tras
  años de uso diario) donde eso importe.
- `app/Services/Growth/WhoGrowthStandards.php` — tablas L/M/S reales de la
  OMS (Child Growth Standards, 0–24 meses, peso/talla/perímetro craneal
  por sexo) embebidas como constantes PHP, descargadas de `cdn.who.int` y
  no aproximadas, dado el contexto de salud. `percentile()` aplica la
  fórmula LMS y convierte el z-score a percentil con una aproximación
  propia de la CDF normal estándar (Abramowitz & Stegun 7.1.26 — PHP no
  trae una función `erf`/CDF nativa). La edad se calcula con el mismo
  "mes medio" de 30.4375 días que usa la propia OMS
  (`Carbon::diffInDays() / 30.4375`), no `diffInMonths()` de Carbon, para
  no desviarse del criterio con el que se generaron las tablas.
  `GrowthMeasurementController` no calcula el percentil si al `Baby` le
  falta `sex` o `birth_date` — queda `null` en la respuesta en vez de
  fallar, porque no siempre se conocen o se quieren dar esos datos.
- `app/Models/Milestone.php` — la foto de un hito se sube como archivo
  real, no como una URL pegada: a diferencia del `image_url` de LudoDex
  (la carátula de un juego tiene una fuente externa real, BGG), no
  existe ningún sitio del que sacar por URL la foto de un bebé. El
  disco se lee de `config('filesystems.milestones_disk')`
  (`MILESTONES_DISK` en `.env`), no está fijado a `'public'`: en local
  es `public` (servido vía `storage:link`), en producción es `s3`
  apuntando a Cloudflare R2 — el sistema de archivos de Render es
  efímero, así que un disco local ahí perdería las fotos en cada
  redeploy (ver "Despliegue" más abajo). El endpoint de edición es
  `POST`, no `PUT`, porque PHP nunca rellena `$_FILES` a partir del
  cuerpo `multipart/form-data` de una petición `PUT`.
- `app/Services/Sleep/SleepPatternPredictor.php` — predicción de patrones
  de sueño deliberadamente honesta: una media móvil sobre el propio
  historial de siestas del bebé (ventana de vigilia media, duración
  media), no un modelo entrenado ni una tabla de edades. Por debajo de 3
  siestas completas en el historial, devuelve `has_enough_data: false`
  en vez de una predicción inventada con tan pocos datos.

## Notas de arquitectura

Sin worker en segundo plano ni cola persistente por ahora — no hay ninguna
tarea (import externo, envío de email) que lo necesite todavía. Se
revisará en cuanto aparezca una.

## Despliegue

En producción ([pequedex-0phw.onrender.com](https://pequedex-0phw.onrender.com)):
mismo patrón que LudoDex/MIRA MarketLens. Render construye `Dockerfile`
con **Root Directory = `api`** (así el contexto de build es este directorio,
donde vive el propio `Dockerfile` y `composer.json`) y lo despliega en el
plan Free. El propio contenedor ejecuta `php artisan migrate --force` al
arrancar (`docker/entrypoint.sh`), así que un deploy nuevo aplica
migraciones pendientes solo. Auto-Deploy nativo de Render desactivado
(`Off`): el único disparador es el *deploy hook* desde GitHub Actions (ver
más abajo).

Variables de entorno necesarias en Render:

- `APP_KEY`, `APP_URL` (la URL pública del servicio en Render).
- `DB_CONNECTION=pgsql` y `DB_HOST`/`DB_PORT`/`DB_DATABASE`/`DB_USERNAME`/
  `DB_PASSWORD`/`DB_SSLMODE=require` con los datos de Neon. **Usar el host
  directo de Neon, no el "pooled"** (sin el sufijo `-pooler`): con el
  pooler (PgBouncer en modo transacción) las migraciones pueden fallar de
  forma intermitente en vez de mostrar el error real — mismo problema ya
  documentado en LudoDex.
- `MILESTONES_DISK=s3` más `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/
  `AWS_BUCKET`/`AWS_ENDPOINT`/`AWS_URL` de un bucket de Cloudflare R2
  (compatible con la API S3; `AWS_DEFAULT_REGION=auto` y
  `AWS_USE_PATH_STYLE_ENDPOINT=true`). Sin esto, las fotos de los hitos
  desaparecerían en cada redeploy — el disco local de Render no es
  persistente.
- `SESSION_DRIVER`/`CACHE_STORE`/`QUEUE_CONNECTION` a `database` (no hay
  Redis ni *worker* en el plan Free).

El *deploy hook* de Render se dispara desde GitHub Actions
(`.github/workflows/ci.yml`, secret `RENDER_DEPLOY_HOOK_URL`) tras pasar
tests/lint/build de ambas apps, no desde el webhook nativo de Render —
mismo arreglo ya aplicado en LudoDex tras encontrar ahí que el webhook
nativo se perdía deploys de forma intermitente.
