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
php artisan serve
```

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
  real al disco `public` (`Storage::disk('public')`), no como una URL
  pegada: a diferencia del `image_url` de LudoDex (la carátula de un
  juego tiene una fuente externa real, BGG), no existe ningún sitio del
  que sacar por URL la foto de un bebé. El endpoint de edición es
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
