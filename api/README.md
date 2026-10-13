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
- `app/Http/Controllers/Auth/ProfileController.php` /
  `app/Services/Users/AvatarProcessor.php` — datos personales, cambio de
  contraseña y foto de perfil, mismo patrón que MIRA MarketLens. La foto
  se guarda como `data:` URI (WebP de 128×128 como máximo, ~3-6 KB) en
  la tabla `user_avatars` (`App\Models\UserAvatar`), no como archivo en
  disco — a diferencia de la foto de un hito (ver más abajo), aquí no
  hace falta R2: es una imagen pequeña (`AvatarProcessor`, GD puro). En
  **su propia tabla y no en una columna de `users`** porque Sanctum carga
  la fila entera del usuario en cada petición autenticada: con el avatar
  antiguo (PNG de 320 px, ~80 KB) esos 80 KB salían de Neon en cada
  petición, sondeo incluido, y eran casi todo el consumo de red del
  proyecto. `User::avatar` es ahora un atributo (en `$appends`) que lee
  la relación solo al serializar el usuario; los hitos precargan
  `likedBy.avatarRecord`. La migración `move_avatar_to_user_avatars_table`
  copia y reduce los avatares existentes. Sin errores por campo en la
  respuesta como en LudoDex/MIRA - el frontend de esta app no los pinta,
  así que no hace falta desglosarlos aquí tampoco.
- `ProfileController::updateActionBarCategories()` — qué categorías
  (toma/sueño/pañal/crecimiento/hito) quiere cada cuidador en la barra
  de accesos del dashboard (ver `web/README.md`). Columna
  `users.action_bar_categories` (JSON nullable, `null` = las 5
  visibles, valor por defecto sin migrar filas existentes).
  `UpdateActionBarCategoriesRequest` exige un array de al menos 3
  valores conocidos (`min:3` + `Rule::in`) — el mismo mínimo que
  impone el frontend deshabilitando el icono antes de dejar
  deseleccionar más, para que nunca llegue a depender solo de la
  validación del servidor.
- `ProfileController::updatePredictionsEnabled()` — activa/desactiva
  las predicciones de próxima toma/próximo sueño (ver `web/README.md`).
  Columna `users.predictions_enabled` (booleana, `default(true)`),
  `PUT /user/predictions`, mismo patrón que `action_bar_categories`
  justo arriba pero sin array que validar, solo `required|boolean`.
- `ProfileController::updateTodaySummaryEnabled()` — activa/desactiva
  las tarjetas resumen del día (tomas/sueño/pañales bajo la tarjeta del
  bebé, ver `web/README.md`). Mismo patrón exacto que
  `updatePredictionsEnabled()` de arriba: columna
  `users.today_summary_enabled` (booleana, `default(true)`), `PUT
  /user/today-summary`, `required|boolean` sin más validación.
  `updateSwipeToDeleteEnabled()` (columna `swipe_to_delete_enabled`,
  `default(false)`, `PUT /user/swipe-to-delete`) sigue el mismo patrón
  también, documentado ya antes junto al ajuste en sí en
  `web/README.md`. `updateInteractionFeedbackEnabled()` (columna
  `interaction_feedback_enabled`, `default(true)`,
  `PUT /user/interaction-feedback`) es la cuarta copia del mismo
  patrón — controla el sonido/vibración al interactuar con la
  interfaz, ver `web/README.md`. `updateDefaultDiaperSize()`/
  `updateDefaultFeedDuration()` rompen el patrón en un punto: no son
  booleanos, así que no hay nada que invertir - cada petición manda
  directamente el valor elegido (o `null` para "Sin indicar"). Columnas
  `users.default_diaper_size` (nullable, `App\Enums\DiaperSize`) y
  `users.default_feed_duration_minutes` (nullable, `unsignedSmallInteger`),
  `PUT /user/default-diaper-size` / `PUT /user/default-feed-duration`,
  validados con `Rule::enum`/`Rule::in([10,20,30,45])` - mismas opciones
  que ofrecen los propios formularios "+ Pañal"/"+ Toma". Ver
  `web/README.md` para cómo se usan al preseleccionar un formulario
  nuevo. `updateSoundsEnabled()`/`updateStatsEnabled()` (columnas
  `sounds_enabled`/`stats_enabled`, `default(true)`,
  `PUT /user/sounds` / `PUT /user/stats`) vuelven al patrón booleano
  simple de `updateInteractionFeedbackEnabled()` - quinta y sexta copia
  - y solo controlan si se ve la tarjeta de enlace correspondiente en
  el dashboard, no si la ruta en sí es accesible, ver `web/README.md`.
  `updateMilestonesEnabled()` (columna `milestones_enabled`,
  `default(true)`, `PUT /user/milestones`) es la séptima copia - a
  diferencia de sounds/stats, "hitos" es una de las 5 categorías de la
  barra de accesos personalizable (`action_bar_categories`), así que
  este interruptor actúa por encima de esa selección en el frontend, no
  como una tarjeta de enlace aparte, ver `web/README.md`.
- `app/Models/Baby.php` / `app/Policies/BabyPolicy.php` — el recurso
  compartido entre cuidadores (tabla pivote `baby_user`, sin distinción
  admin/no-admin: cualquier cuidador vinculado tiene acceso total de
  lectura/escritura). `FeedController`/`SleepController`/
  `DiaperChangeController` autorizan siempre contra el `Baby` padre
  (`$this->authorize('update', $baby)`), nunca contra el `user_id` de la
  fila que se está editando — el campo `user_id` en `feeds`/`sleeps`/
  `diaper_changes` es solo trazabilidad de quién lo registró, nunca se
  usa para decidir quién puede verlo o editarlo.
- `app/Http/Controllers/Temperatures/TemperatureController.php` — CRUD
  de `temperatures` (`measured_at`, `celsius` decimal con un decimal,
  `method` opcional: `axila`/`recto`/`oido`/`frente` vía
  `App\Enums\TemperatureMethod`, `notes`), mismo patrón que los pañales
  (`AuthorizesBabyAccess`, `ValidatesNotBeforeBirth`, nada en el
  futuro). `celsius` se valida entre 34 y 43 °C: fuera de ahí es casi
  seguro un error al teclear (3.7 en vez de 37). Entra en
  `TimelineController` como `type: 'temperature'` (los dos modos,
  "recientes" y "un día"), en `action_bar_categories` como categoría
  válida (desactivada por defecto en el frontend) y en el export de
  estadísticas como bloque `temperature` opcional (`null` si el bebé
  nunca ha tenido una medición). `users.default_temperature_method`
  (`PUT /user/default-temperature-method`, nullable, mismo enum) guarda
  el lugar preferido que el frontend preselecciona al crear, igual que
  `default_diaper_size`.
- `app/Services/Vaccinations/VaccinationTemplates.php` +
  `resources/vaccination-templates/` — las plantillas de vacunas son
  datos, no código: `comun.php` es el calendario común del Consejo
  Interterritorial (recomendado 2026, aprobado el 12/12/2025, parte
  0-14 años) y cada comunidad con variaciones tiene su fichero, que
  solo dice lo que cambia (`replace`/`add`/`remove` por `code`). Hay
  fichero para las 17 comunidades + Ceuta y Melilla, recopilados en
  2026, cada uno con su fuente y fecha en la cabecera. 13 salen del
  calendario oficial completo (Andalucía, Baleares, Canarias, Cantabria,
  Castilla-La Mancha, Castilla y León, Cataluña, C. Valenciana,
  Extremadura, Galicia, La Rioja, Madrid, País Vasco); en Aragón,
  Asturias, Murcia, Navarra, Ceuta y Melilla no se encontró el oficial
  de 2026 legible y solo se aplica el cambio de meningococo (MenACWY),
  contrastado con el CAV-AEP. Sin comunidad indicada se usa el común.
  Un test recorre todas las comunidades y comprueba que `replace`/
  `remove` solo usan códigos que existen en el común. Cada
  elemento lleva `months` (fecha prevista = nacimiento + N meses),
  `age_label` y `optional` (hepatitis B al nacer, VRS, gripe).
  `babies.region` (`App\Enums\Region`, 17 comunidades + Ceuta y
  Melilla) y `babies.vaccinations_enabled` se cambian con `PUT
  /babies/{baby}/vaccinations/settings`, que genera la lista al
  activar (sin duplicar si ya existe) y, al cambiar de comunidad,
  rehace las de plantilla todavía sin poner (conserva las puestas, las
  añadidas a mano y las editadas: `vaccinations.edited`, que se marca al
  cambiar nombre, fecha prevista o notas, no al marcarla como puesta).
  Al cambiar `birth_date` (`PUT /babies/{baby}`),
  `VaccinationTemplates::recalculateDueDates()` rehace la fecha prevista
  de las de plantilla sin poner, salvo las de `due_date_edited`.
  Desactivar no borra nada. CRUD en
  `/vaccinations` (marcar como puesta: `given_at`, no futura ni antes
  del nacimiento) y `/checkups` (revisiones a mano, pueden estar en el
  futuro). El export de estadísticas acepta un bloque `vaccinations`
  opcional (resumen, próximas y puestas).
- Registro sin conexión: `feeds`, `sleeps`, `diaper_changes` y
  `temperatures` tienen un `client_uuid` (nullable, único) que manda el
  móvil al crear. `App\Http\Controllers\Concerns\CreatesIdempotently`
  (`createOnce()`) devuelve el registro ya existente (200) si llega otra
  vez el mismo `client_uuid` - un reintento después de que la respuesta
  se perdiera - en vez de crear un duplicado (201 si es nuevo). Sin
  `client_uuid`, todo igual que antes.
- Referencias de sueño por edad: el export acepta un `sleep_reference`
  opcional (`total` con min/max/source `nsf`|`aasm`/verdict, y
  `wake_window` con min/max/verdict), calculado en el móvil
  (`web/src/lib/sleepReference.ts`). `sleepReferenceNotes()` lo
  convierte en las líneas de texto que pintan `pdf/stats` y
  `pdf/consult-summary`. Sin él (cliente antiguo o sin fecha de
  nacimiento), no se muestra nada.
- Resumen para la consulta: `POST /babies/{baby}/stats/export` acepta
  `mode` (`full` por defecto, o `summary`), `questions` (nullable, hasta
  1000 caracteres), `high_temperatures` (hasta 10 `{celsius, at}`) y el
  periodo `14d`. Con `summary` renderiza `pdf/consult-summary.blade.php`
  (una página: ficha grande del bebé, fichas de 3 en 3, gráfica de las
  horas de sueño de 7 días y color de las cacas) y devuelve
  `resumen-consulta.pdf`; `StatsExportController::recentVaccines()`
  filtra las vacunas puestas dentro del periodo. El bloque de preguntas
  va al final y solo si `questions` trae texto. `vaccinations` puede ser
  `null` (vacunas desactivadas): las listas `given_list` y
  `upcoming_list` solo son obligatorias cuando es un objeto.
- Avisos suaves del Dashboard: `GET /babies/{baby}/diaper-changes`
  acepta un `since` opcional (fecha) para pedir solo los últimos días
  en vez del historial entero, y `users.alerts_enabled` (`PUT
  /user/alerts`, booleano, activado por defecto) los apaga. El cálculo
  de los avisos vive entero en el frontend (`web/src/lib/dailyAlerts.ts`),
  por la misma razón que Estadísticas: depende de la hora local.
- `BabyController@destroy` — `DELETE /babies/{baby}`, borrado
  permanente del bebé y cuanto cuelga de él. `leave()` (desvincular al
  usuario actual, dejando el bebé para el resto) ya rechazaba salir
  como único cuidador con un 422 — dejaría el bebé sin nadie vinculado
  — pero no había ninguna forma real de eliminarlo del todo en ese
  caso; la única salida era compartir el código de invitación con
  alguien más solo para poder desvincularse después. `destroy()` cubre
  justo ese hueco: mismo `lockForUpdate()` que `leave()` para que dos
  peticiones simultáneas no dejen pasar un `count() > 1` obsoleto,
  rechazado con 422 si hay más de un cuidador (borrar los datos de un
  bebé que otro cuidador sigue usando no es una decisión unilateral).
  `cascadeOnDelete()` ya cubre feeds/sueños/pañales/medidas/hitos/
  contracciones a nivel de base de datos, pero eso no dispara eventos
  de Eloquent — las fotos de hitos viven en disco, no en la BD (ver
  `Milestone.php` más abajo), así que se limpian a mano antes del
  `delete()`, mismo `Storage::disk(...)->delete()` que ya usa
  `MilestoneController::destroy()` para una sola foto.
- `UpdateFeedRequest`/`UpdateSleepRequest`/`UpdateDiaperChangeRequest` —
  mismas reglas que su `Store*Request`, no un `sometimes` parcial: en
  `Feed`, por ejemplo, `side`/`amount_ml` dependen de `type` (uno de los
  dos es obligatorio y el otro está prohibido según cuál sea), así que
  una edición manda la fila completa de vuelta en vez de un parche —
  reutilizado por el frontend, cuyo formulario de edición es el mismo
  de "+ Toma"/"+ Sueño"/"+ Pañal" precargado (ver `web/README.md`).
- `Feed::milk_type` (`App\Enums\MilkType`, calostro/leche) /
  `DiaperChange::residue_color` (`App\Enums\DiaperResidueColor`, verde/
  amarillo/marrón/meconio) — mismo patrón `required_if`/
  `prohibited_unless` que `Feed::side` (solo válido en una toma de
  pecho): `milk_type` solo tiene sentido con `type = pecho`.
  `residue_color` sigue una variante más laxa, `prohibited_if` en vez
  de `required_if`/`prohibited_unless`: es opcional incluso cuando
  tiene sentido (`type = sucio`/`ambos`, nadie está obligado a anotarlo
  cada vez), pero prohibido explícitamente para `type = mojado` — un
  pañal solo mojado no tiene heces que describir.
- `DiaperChange::size` (`App\Enums\DiaperSize`, '1'..'5'/'6+') — opcional
  igual que `residue_color`, pero sin ninguna regla `prohibited_if`: a
  diferencia del color (que solo tiene sentido con algo que mirar), la
  talla aplica igual a `mojado`/`sucio`/`ambos`. Estándar genérico, no
  ligado a ninguna marca concreta; sin "RN" (recién nacido), a petición
  expresa.
- `Feed::ended_at` — existía en la tabla y el modelo desde el principio
  (mismo patrón que `Sleep`), pero sin usar desde el frontend hasta que
  se le añadió `prohibited_unless:type,pecho` a su validación: la
  duración de una toma solo tiene sentido al pecho, no en biberón/sólido
  (nadie cronometra un biberón). El frontend (ver `web/README.md`) manda
  `started_at` + unos minutos elegidos de un selector, convertidos a un
  `ended_at` absoluto antes de mandarlos — los minutos son solo el
  vocabulario del formulario, la API sigue viendo el mismo par de
  instantes que ya usaba `Sleep`.
- `SleepController::index` admite un parámetro opcional `?since=` para
  acotar a una ventana reciente en vez de traer el historial completo
  del bebé. Añadido originalmente para el gráfico semanal de sueño del
  frontend; ese gráfico se movió a Estadísticas y pasó a alimentarse
  del historial completo que esa página ya cargaba (`babies.statsSleeps`,
  ver `web/README.md`), así que hoy ningún caller del frontend manda
  `since` — se deja el filtro en el endpoint (nullable, sin romper nada
  al omitirlo) como capacidad general del recurso, no código muerto que
  haya que retirar. El filtro comprueba `started_at`, `ended_at` o
  `ended_at IS NULL` — no solo `started_at` — para no perder un sueño
  que empezó antes de la ventana pero sigue en curso o terminó dentro
  de ella.
- `Baby::generateInviteCode()` — código de 8 caracteres sin `0`/`O`/`1`/`I`
  (se escriben/leen a mano, esos pares se confunden fácilmente), con
  comprobación de colisión real en vez de asumir que el espacio de
  claves (32⁸) es suficientemente grande.
- `TimelineController` — mezcla tomas/sueño/pañales en una sola lista
  ordenada en PHP, no con un `UNION` SQL entre tres tablas de forma
  distinta: el registro de una familia no alcanza un volumen (ni tras
  años de uso diario) donde eso importe. Responde con `ETag` y admite
  `If-None-Match`: la huella (filas, última modificación y último id de
  las cuatro tablas, con `date`/`limit`) cuesta cuatro agregados
  diminutos y, si coincide, se contesta `304` sin leer filas - el
  Dashboard sondea cada 15 s y casi siempre no hay nada nuevo.
- `BootstrapController` — `GET /babies/{baby}/bootstrap`: todo lo del
  Dashboard en una petición (llama a los mismos controladores que los
  endpoints individuales, así que cada sección es idéntica; incluye
  `timeline_etag`). Acepta `tz` y `since` como ellos. Vacunas y revisiones
  solo si están activadas para el bebé. Pide los pañales recientes en modo
  `compact` (id, hora y tipo). **Condicional**: responde con `ETag` y
  contesta `304` a `If-None-Match` si la huella no ha cambiado
  (`FORMAT_VERSION` invalida las que los móviles ya guardan si cambia la
  forma de la respuesta).
- `app/Services/Support/BabyActivityVersion.php` — la huella: filas, última
  modificación y último id de cada tabla del bebé (y, para las fotos de
  hitos, cuántas hay), en UNA consulta `UNION ALL` recordada durante la
  petición. La usan la línea temporal (4 tablas) y el bootstrap (todas).
  Devuelve `null` si falla (se registra) y entonces se responde completo y
  sin ETag. Ojo: es SQL propio y producción es PostgreSQL mientras los
  tests corren en SQLite; el trabajo `backend-postgres` de CI la ejercita
  contra PostgreSQL.
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
  `valueAt()` es el inverso (el valor de la medida para un z-score) y
  `referenceCurves()` da, mes a mes de 0 a 24, los percentiles 3/15/50/
  85/97 que sirve `GET /babies/{baby}/growth-reference`
  (`GrowthReferenceController`, `curves: null` sin sexo o fecha de
  nacimiento) para que Estadísticas dibuje las bandas de la OMS sin
  duplicar las tablas en el frontend. El PDF de estadísticas dibuja las
  mismas bandas en su SVG de crecimiento
  (`StatsExportController::referenceSamples()`).
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
- `app/Enums/MilestoneCategory.php` / tabla `milestone_likes` — un hito
  puede llevar una categoría opcional (sonrisa/diente/pasos/palabra/
  otro; `nullable`, sin valor por defecto — "otro" es una elección real,
  no lo que le toca a quien no elige nada) y recibir un "me encanta" de
  cualquier cuidador vinculado al bebé
  (`POST /babies/{baby}/milestones/{milestone}/like`, un único *toggle*,
  no rutas separadas de like/unlike). `milestone_likes` es una tabla
  pivote pura sin `id`, mismo patrón que `baby_user`. El *toggle* se
  autoriza con `authorize('view', $baby)`, no `'update'` como el resto
  de acciones sobre un hito: reaccionar es una interacción ligera que
  cualquiera con acceso de lectura al bebé debería poder hacer, no una
  edición del contenido.
- `app/Services/Milestones/PhotoProcessor.php` — la foto de un hito se
  reduce al subirla a WebP de 1600 px como máximo (~150-400 KB en vez de
  los megas de una foto de móvil), con GD puro. Aplica la orientación
  EXIF antes de recodificar (el Dockerfile instala la extensión `exif`):
  el móvil guarda la foto "tumbada" con una etiqueta de giro y, sin
  aplicarla, saldría de lado. Devuelve `null` si no puede o no conviene
  procesarla (ilegible, más de 50 Mpx, sin memoria suficiente) y
  `MilestoneController::storePhoto()` guarda entonces el original. Las
  fotos subidas antes se reducen con `php artisan milestones:shrink-photos`
  (`App\Console\Commands\ShrinkMilestonePhotos`): sin `--apply` es una
  simulación; `--backup=<carpeta>` copia antes cada original a disco local
  (si la copia falla, esa foto se deja como está); con `--apply` sube la
  versión reducida al disco de los hitos
  (`MILESTONES_DISK`), apunta el hito a ella y borra la original solo si la
  nueva existe. Contra producción hay que ejecutarlo con las variables de
  Neon y del almacén de fotos puestas (Render gratuito no tiene terminal).
- `docker/opcache.ini` + `docker/entrypoint.sh` (`php artisan optimize`) —
  sin OPcache en modo CLI y sin cachés de configuración, rutas, eventos y
  vistas, cada petición recompilaba todo Laravel. Medido en local:
  220 ms → 40 ms con OPcache → 31 ms con las cachés. `validate_timestamps=0`
  porque dentro de la imagen los ficheros no cambian. Las cachés se
  generan al arrancar (no al construir la imagen) porque la configuración
  lee las variables de entorno de Render. El código no usa `env()` fuera
  de `config/` (si lo hiciera, con la caché devolvería `null`).
- `docker/uploads.ini` — subir un hito con foto desde el móvil se
  quedaba colgado en producción sin ningún error: la imagen Docker no
  llevaba ningún `php.ini` propio, así que PHP usaba sus valores por
  defecto (`upload_max_filesize=2M`, `post_max_size=8M`), por debajo
  de lo que la propia app ya valida (`UpdateMilestoneRequest` acepta
  hasta 8MB). Una foto real de móvil supera 2MB sin esfuerzo, y PHP
  descarta la petición entera en silencio antes de que Laravel llegue
  a verla. Nunca se detectó en local porque el `php.ini` de XAMPP ya
  permite 40MB. Este archivo se copia a `/usr/local/etc/php/conf.d/`
  en el Dockerfile (`upload_max_filesize=10M`, `post_max_size=12M`).
- `app/Http/Controllers/Auth/ProfileController.php` /
  `app/Services/Users/AvatarProcessor.php::process()` — antes de
  decodificar la imagen con `imagecreatefromstring()` (que la carga
  entera en memoria), primero lee sus dimensiones con `getimagesize()`
  (que solo lee la cabecera) y rechaza cualquier cosa por encima de
  `MAX_SOURCE_DIMENSION`. Sin esto, un archivo pequeño en bytes pero
  con dimensiones absurdas (un color sólido comprime muy bien) podría
  agotar la memoria de ese worker antes de que hubiera ocasión de
  redimensionarlo.
- `app/Policies/BabyPolicy.php` — `view`/`update` comprueban
  pertenencia con `$baby->users()->whereKey($user->id)->exists()`, una
  consulta, no `$baby->users->contains($user)`, que cargaría toda la
  relación en memoria solo para mirar si un id está en la lista.
- `app/Http/Controllers/Babies/TimelineController.php` — cada una de
  las tres subconsultas (tomas/sueño/pañales) se limita a `$limit`
  filas por su cuenta antes de fusionar, no solo el resultado final.
  El dashboard sondea este endpoint cada 15 segundos mientras está
  abierto, así que sin este límite por subconsulta el coste crecía con
  el histórico completo del bebé en vez de con lo que se muestra.
- `app/Services/Sleep/SleepPatternPredictor.php` — predicción de sueño
  explicable, sin aprendizaje automático, sobre los 14 días anteriores
  al último sueño registrado (`GET /babies/{baby}/sleep-prediction?tz=`,
  con la zona horaria del móvil; desconocida o ausente = UTC):
  1. **Ventana por número del día**: un sueño que empieza a partir de
     las 19:00 o antes de las 6:00 (hora local) es de noche; la primera
     ventana tras la noche es la 1, luego 2, 3... Se predice con la
     mediana de esa misma ventana en días anteriores (`based_on:
     wake_window_by_number`, `window_number`), o con la de todas si
     no hay bastantes (`average_wake_window`). Los despertares entre dos
     tramos de noche no cuentan como ventana.
  2. **Recencia**: mediana ponderada, cada día de antigüedad pesa un 15 %
     menos (0,85^días). Mediana y no media porque las ventanas son muy
     asimétricas (muchas cortas, alguna muy larga) y la media se iba
     hacia esas colas.
  3. **Referencia por edad** (`WakeWindowReference`, misma tabla que
     `web/src/lib/sleepReference.ts`): su punto medio entra como
     observaciones más (`AGE_PRIOR_WEIGHT` = 2), así que domina con pocos
     datos y casi no cuenta con muchos. Sin datos propios la predicción
     sale solo de ella (`based_on: age_reference`), aunque
     `has_enough_data` sea false.

  Las tres predicciones (siguiente siesta, despertar y siguiente toma)
  devuelven además `prediction.range: {from, to}`: el rango habitual
  (percentil 20 a 80 de las últimas 20 ventanas, duraciones o huecos,
  `Services/Support/Quantiles`), siempre con `prediction.at` dentro, o
  `null` con menos de 8 observaciones.

  Validado con un backtest sobre un mes de datos reales de un bebé
  (2026-10-12, ver CHANGELOG): con la media, la referencia por edad sola
  acertaba más que el predictor; con la mediana ponderada y peso 2 sube
  de ±15 min en el 19 % de las siestas a ~39 % (error mediano de 34 a
  20 min). Es un solo bebé de menos de un mes: valida que no hay errores
  gordos, no que sea fiable en general.

  Con un sueño en curso predice el despertar con la mediana ponderada
  por recencia de la duración de los sueños del mismo tipo (noche o
  siesta; el campo se sigue llamando `average_sleep_duration_minutes`).
  **Pendiente, posible
  mejora:** acortar la ventana tras una siesta corta (p.ej. de menos de
  30 min). Se dejó fuera porque sus umbrales no tienen referencia
  publicada y aprenderlos por bebé necesita muchos datos; retomarlo solo
  si las predicciones tras siestas cortas fallan claramente.
- `app/Services/Feeds/FeedPatternPredictor.php` — misma idea que el de
  sueño, aplicada a tomas: mediana móvil del hueco entre tomas del propio
  bebé (mediana y no media, medido con datos reales; el campo se sigue
  llamando `average_gap_minutes`). Más simple que el de sueño porque una toma es un instante
  (`started_at`), no un intervalo con su propia duración y un estado
  "en curso" — solo hay una cosa que predecir (la siguiente toma), no
  dos. Huecos de más de 8h (frente a las 6h de sueño, porque las tomas
  suelen estar más juntas entre sí que las siestas) se descartan de la
  media por ser casi siempre un tramo nocturno, no el ritmo real del
  bebé.
- `app/Http/Requests/Concerns/ValidatesNotBeforeBirth.php` — trait
  compartido por los `Store`/`UpdateRequest` de tomas, sueño, pañales,
  medidas e hitos: nada de eso tiene sentido antes de que el bebé haya
  nacido. Añade `after_or_equal:<birth_date>` a la fecha del recurso
  cuando el `Baby` de la ruta ya tiene `birth_date` puesto, y no añade
  nada si todavía no lo tiene (sex/birth_date son opcionales, así que
  puede no haber nada contra lo que comparar). `after_or_equal`, no
  `after`: el día exacto del nacimiento es válido (un hito de
  "Nacimiento" ese mismo día).
- `app/Http/Requests/Concerns/HasDateFieldMessages.php` — trait
  hermano del anterior, mismo criterio de "compartido por todos los
  `Store`/`Update` con un campo de fecha": los cuatro mensajes que se
  repiten (`required`/`date`/`before_or_equal`-futuro/`after_or_equal`
  -nacimiento) parametrizados por el nombre del campo y una etiqueta
  articulada ("la hora de inicio", "la fecha de la medida"...). Bug
  real reportado en vivo: sin mensajes propios, Laravel caía en su
  traductor genérico (`lang/es/validation.php`), que para
  `after_or_equal:started_at` resuelve el parámetro de comparación
  a través del mismo array `attributes` que el propio campo - como
  `started_at` mapea a "fecha" ahí, el mensaje salía "El campo ended
  at debe ser una fecha posterior a fecha" (ni "ended_at" traducido,
  ni queda claro posterior a qué). Aplicado a los doce
  `Store`/`Update*Request` de tomas, sueños, pañales, medidas, hitos y
  contracciones, con los mensajes propios de cada regla que no encajaba
  en el trait (side/amount_ml de tomas, required_without_all de
  medidas, título/foto de hitos, intensidad de contracciones) añadidos
  aparte en cada uno.
- **Contador de contracciones**
  (`app/Http/Controllers/Contractions/ContractionController.php`,
  `Contraction`, tabla `contractions`) — mismo patrón de autorización
  que `SleepController`: `index()`/`destroy()` llaman
  `authorize('view'|'update', $baby)` en el controlador,
  `store()`/`update()` no llaman `authorize()` ahí porque
  `StoreContractionRequest`/`UpdateContractionRequest` ya usan el trait
  `AuthorizesBabyAccess`, que autoriza antes de que corran las
  `rules()`. A diferencia de todos los demás `Store`/`UpdateRequest` de
  la app, estos dos no usan `ValidatesNotBeforeBirth`: una contracción
  se registra precisamente antes de que exista `birth_date`, así que
  exigir `after_or_equal:birth_date` invertiría el propósito entero de
  la funcionalidad. `store()` no recibe body en el caso normal ("Inicio
  de contracción" pulsado ahora mismo) — `started_at` es `sometimes` y
  el controlador usa `$request->validated('started_at') ?? now()`; fija
  `intensity: 0` explícitamente en el array de `create()` en vez de
  confiar en el `->default(0)` de la migración, porque Eloquent no
  repuebla en memoria un atributo omitido a partir del valor por
  defecto de la columna — solo lo hace la fila en la base de datos, así
  que el JSON de respuesta devolvía `null` sin este fix. Mismo motivo,
  bug real encontrado más tarde probando en vivo: `ended_at` tampoco se
  pasaba a `create()`, así que la clave faltaba del todo en el JSON (ni
  siquiera `null`) — el frontend detecta la contracción en marcha
  comparando `ended_at === null`, y `undefined !== null`, así que el
  botón de inicio/detener se quedaba atascado. Se corrige igual: pasar
  `'ended_at' => null` explícitamente en el `create()`. Otro bug real
  encontrado en vivo, este en `UpdateContractionRequest`: la regla de
  `ended_at` exigía `after:started_at` (estrictamente posterior), pero
  el `datetime-local` del frontend solo tiene precisión de minuto, así
  que editar una contracción real de menos de un minuto dejaba ambos
  valores exactamente iguales y el guardado fallaba con un 422.
  Cambiado a `after_or_equal:started_at`.
  `Baby::water_broke_at` (columna nueva, `datetime` normal, no
  `date:Y-m-d` como `due_date`/`birth_date` — aquí sí importa la hora)
  se actualiza reutilizando `BabyController@update`/`UpdateBabyRequest`
  sin flujo nuevo: fijar, editar y "restablecer" (`null`) son los
  mismos tres casos que ya cubre esa ruta.
- `app/Http/Controllers/Contractions/ContractionsExportController.php`
  + `resources/views/pdf/contractions.blade.php` — exportación a PDF
  vía `barryvdh/laravel-dompdf` (`Pdf::loadView(...)->stream()`, sin
  guardar el archivo en disco), agrupada por día, con el intervalo a la
  contracción anterior calculado sobre la lista completa del bebé, no
  solo del día — así el primer registro de un día nuevo compara contra
  el último del día anterior, igual que la app de referencia que
  inspiró esta funcionalidad. Devuelve el PDF inline
  (`Content-Type: application/pdf`), no como adjunto forzado, porque el
  frontend lo pide como blob autenticado por Bearer token, no con un
  enlace directo. La plantilla usa filas tipo tarjeta (fondo claro,
  esquinas redondeadas, espaciado vía `border-spacing`) en vez de una
  tabla con rayado alterno, para acercarse al PDF de la app de
  referencia. Hallazgo real al intentar mostrar la intensidad con el
  mismo icono de rayo que la app: un `<svg>` inline no se renderiza en
  absoluto con esta configuración de dompdf (confirmado aparte, con un
  HTML mínimo), y el carácter Unicode "●" probado antes tampoco - sale
  como "?" con la fuente por defecto. Lo que sí funciona de forma
  fiable es un `<img src="data:image/svg+xml;base64,...">`, así que
  `boltDataUri()` en el controlador construye esos dos *data URIs*
  (rayo activo/apagado) una sola vez por exportación y se los pasa a
  la vista, en vez de generar SVG dentro del bucle Blade. Bug real
  encontrado en vivo: el PDF listaba las contracciones de más antigua a
  más reciente (`orderBy('started_at')`, #1 = la primera), al revés que
  `ContractionTimeline.vue` en la app, donde la más reciente se pinta
  arriba con el número más alto. Cambiado a
  `orderByDesc('started_at')` con `'number' => $total - $index`, y el
  intervalo entre filas se recalcula sobre el "vecino más antiguo" (el
  siguiente índice del array, ya que la lista corre de más reciente a
  más antigua) en vez de un `$previousEnd` acumulado que solo tenía
  sentido recorriendo en orden cronológico. La plantilla recibió
  después una pasada de legibilidad para papel: la escala tipográfica
  completa sube de tamaño (estaba pensada para pantalla, 10-13px),
  el separador de día se centra en su barra, las columnas se
  reequilibran (duración, que solo contiene "mm:ss", se estrecha en
  favor de inicio/fin/intensidad) y el contenido de la tabla pasa a
  alinearse a la derecha. Cabecera y pie de página nuevos: la cabecera
  suma la fecha/hora de generación y una barra con tres estadísticas
  sobre el historial completo del bebé (contracciones totales, duración
  media, intervalo medio — acumuladas en segundos dentro del mismo
  bucle que ya construía cada fila, no recalculadas aparte; el
  intervalo medio excluye los huecos "> 60 min" por el mismo motivo que
  se imprimen así en la tabla), y el pie repite en cada página
  (`position: fixed`) el logo de la app junto a su nombre — el logo se
  reconstruye a partir de `public/favicon.svg` con relleno plano en vez
  del `<style>` con gradiente y media query del original
  (`logoDataUri()`), porque dompdf no soporta ninguno de los dos de
  forma fiable dentro de un `<img>` de datos. La rotura de bolsa de
  aguas (`Baby::water_broke_at`) no aparecía en el PDF hasta ahora; se
  fusiona como una entrada más (`type: contraction|water`) en la misma
  colección que las filas de contracciones antes de ordenar por fecha y
  agrupar por día, así que aparece en su hueco cronológico exacto — el
  cálculo de intervalos sigue operando solo sobre `$contractions`, sin
  verse afectado por la fusión. La fila usa las mismas columnas que el
  resto de la tabla (icono en la columna del número, fecha en la
  columna de inicio, texto centrado en el resto del ancho) pero en azul
  (`#3f7ea6`) en vez del marrón de marca, para distinguirse como un
  evento aparte. Cabecera rediseñada otra vez más tarde: la tarjeta con
  degradado y titular en grande que ya lleva Estadísticas, con una
  diferencia real - Contracciones es alcanzable solo mientras el bebé
  **no** ha nacido todavía, lo contrario de Estadísticas, así que el
  titular de la tarjeta es la cuenta atrás a la fecha prevista
  ("12 días" / "¡Puede ser hoy!" si es hoy mismo), no la edad. Mismo
  `app/Services/Babies/BabyAgeHeadline.php` que usa
  `StatsExportController` (ver más abajo) - cubre las tres variantes
  (nacido/previsto/sin ninguna fecha) desde un único sitio en vez de
  reimplementar el cálculo aquí solo para el caso que a Estadísticas
  nunca le hacía falta.
- `app/Services/Babies/BabyAgeHeadline.php` — mismo cálculo de edad que
  `getBabyAge()`/`heroHeadline` en `lib/babyAge.ts`/`DashboardView.vue`
  (días mientras no cumple un mes, semanas después - el mismo
  desbordamiento de calendario real que usa Carbon al sumar un mes a un
  día que el mes siguiente no tiene, no una aproximación de "30 días";
  confirmado con un test que lo fuerza con un bebé nacido el 31 de
  enero), o una cuenta atrás a la fecha prevista para un bebé que
  todavía no ha nacido. Compartido por las cabeceras de los dos PDF
  (Contracciones y Estadísticas) en vez de vivir duplicado o solo donde
  se necesitó primero - nació como un método privado de
  `StatsExportController` que solo cubría el caso "nacido", y se sacó a
  su propio servicio al necesitarlo también Contracciones con las otras
  dos variantes.
- `app/Http/Controllers/Stats/StatsExportController.php`
  + `app/Http/Requests/Stats/ExportStatsRequest.php`
  + `resources/views/pdf/stats.blade.php` — exportación a PDF de
  "Estadísticas" (`POST /babies/{baby}/stats/export`), mismo
  `barryvdh/laravel-dompdf` y mismo criterio de cabecera/pie que
  `pdf/contractions.blade.php` (incluido `logoDataUri()`, reutilizado
  tal cual). A diferencia de Contracciones, este endpoint no consulta
  nada: todo el cálculo (franjas horarias, medias por día) vive en el
  frontend desde el principio de "Estadísticas" porque Laravel no
  puede saber la zona horaria real del cuidador, así que el único
  trabajo del backend es validar la forma de lo que ya calculó
  `lib/stats.ts` y pasarlo a la plantilla sin tocarlo -
  `ExportStatsRequest` valida los cuatro bloques (sueño, tomas,
  pañales, crecimiento) campo a campo, incluida la enumeración de las
  cuatro franjas horarias (`Rule::in(['dawn', 'morning', 'afternoon',
  'night'])`, `size:4`). Bug real encontrado por un test, no por
  inspección: los `points` de cada métrica de crecimiento
  (`growth.weight_kg.points` etc.) usaban `required|array`, pero
  Laravel trata un array vacío como "no relleno" bajo `required` - un
  bebé sin ninguna medición de una métrica concreta es un estado válido
  (array vacío, no clave ausente), así que la regla se cambió a
  `present|array`, que solo exige que la clave exista.
  `period` (`7d`/`30d`/`all`) indica sobre qué periodo se calcularon
  tomas, sueño y pañales, y sale en el PDF como "Últimos 7 días" etc.
  Sueño: `sleep.average_sleeps_per_day`/`average_longest_stretch_minutes`
  y el reparto día/noche por franja de reloj 20:00-08:00
  (`average_night_sleep_minutes`/`average_day_sleep_minutes`/
  `average_total_sleep_minutes`, `nullable|numeric|min:0`); ya no hay
  "hora habitual de acostarse/despertar" ni total de sueños
  registrados. `sleep.longest_sleep` (array `nullable`, `minutes`/
  `date` `required_with` - un dato de récord, no gated por
  `MIN_SAMPLE_SIZE`), `feed.gap_std_dev_minutes` (regularidad del
  horario). Pañales: `diaper.average_pee_per_day`/
  `average_poop_per_day` ("con pis"/"con caca" al día - un "ambos"
  cuenta en los dos; sustituyen a los % mojado/sucio/ambos y a
  `average_wet_per_day`), un único `by_hour_bucket` de cambios (antes
  pis y caca por separado), `poop_colors` (las cinco claves de color,
  `required|integer`; el controlador solo pinta las que tienen algún
  pañal) y `last_poop_at` (`nullable|date`, sobre todo el historial; el
  controlador lo convierte en "hace X" con Carbon). `weekly_rate` dentro de
  `growthMetricRules()` (velocidad de crecimiento, "por semana" en vez
  de solo el total acumulado). `week_comparison` (array `nullable` en
  bloque, `null` con menos de dos semanas ISO ya completas con dato -
  ver `summarizeWeekComparison()` en `lib/stats.ts`) añade una sección
  propia al PDF, "Esta semana frente a la anterior". `weekly_trend`
  (array `present`, puede venir vacío - un bebé recién creado sin
  historial) y `activity_heatmap` (168 entradas `day_of_week`/`hour`/
  `count`, también `present`) alimentan las dos secciones que antes
  solo existían en pantalla. `StatsExportController::weeklyTrendPoints()`
  reshapea cada semana (solo las 12 más recientes - en papel no hay
  scroll horizontal) a un punto etiquetado por métrica y
  `heatmapGrid()` convierte la lista plana en una rejilla 7×24 densa
  (consumida por `pdf/partials/activity-heatmap-grid.blade.php`, una
  tabla con el color de fondo de cada celda según la densidad) - mismo
  criterio de reshape que ya usaba `growthMetrics` más arriba. Como en
  papel no se puede tocar una celda para ver su detalle (en pantalla
  sí), cada casilla con actividad lleva su número escrito, hay una
  leyenda de la escala de color, y `heatmapSummary()` añade encima
  cuatro fichas: momento más activo (día + hora), día más activo, hora
  del día más activa y total de eventos (`null` sin ningún evento).
  `diaper.average_gap_minutes` (`nullable|numeric|min:0`) es el cuarto
  dato de Pañales, "cada cuánto se cambia".
  `authorize()` comprueba `can('view', $baby)`, no `update` - es un
  endpoint de solo lectura, mismo patrón que
  `ContractionsExportController::show()`.
  `BabyAgeHeadline::forBaby()` (ver su propia entrada más arriba) da la
  edad para la cabecera del PDF (tarjeta con el mismo formato que la
  tarjeta principal del bebé en el dashboard), el mismo número que ya
  ve el cuidador en pantalla.
  **El PDF calca la pantalla de Estadísticas** (mismo orden de
  secciones, mismos rótulos, mismos colores de `base.css`), dentro de
  lo que permite dompdf (CSS2, sin flex/grid - tablas en su lugar):
  cada sección es una tarjeta blanca redondeada con la franja de color
  de su categoría junto al título; las cifras van en fichas de 2 en 2
  con el rótulo arriba a la izquierda (`pdf/partials/tiles.blade.php`,
  omite las de valor `null` igual que los `v-if` de la pantalla);
  franjas horarias, "Sueño esta semana" y tendencia semanal son
  barras VERTICALES (`pdf/partials/vertical-bars.blade.php`: celda con
  `vertical-align: bottom` y un `<div>` con altura en px calculada en
  la plantilla - el mismo dibujo que HourBucketChart.vue/
  WeeklyTrendChart.vue sin flexbox); el reparto día/noche es la misma
  barra partida; récord de sueño y última caca, una fila "rótulo a la
  izquierda, cifra a la derecha"; colores de caca y tallas, pastillas.
  Crecimiento lleva la misma gráfica de línea que GrowthLineChart.vue,
  generada como SVG en data URI por `growthChartDataUri()` (las fechas
  van fuera, en HTML - el texto dentro del SVG no es fiable en dompdf).
  Cada gráfica va en un bloque `page-break-inside: avoid` para no
  partirse entre páginas.
  Bug real de dompdf encontrado al revisar un PDF generado renderizado
  a imagen con Ghostscript (`gswin64c -sDEVICE=png16m`, única forma de
  verlo durante el desarrollo - no hay navegador que lo muestre antes
  de pedirlo a la API real): la tarjeta de cabecera no aparecía en
  absoluto, ni siquiera sin estilo. El selector
  `table.baby-card > tr > td` (combinador `>`) no empareja nada en esta
  versión de dompdf, así que la regla entera se ignoraba silenciosamente
  y la tabla se quedaba sin fondo/padding con los que calcular su
  propia altura - cambiado a `table.baby-card td`, igual que el resto
  de selectores descendientes de esta plantilla. Segundo bug real, en
  un primer intento de llevar emoji (💙/🌸 para el sexo, 🎂 para la
  fecha) a la tarjeta: salían como "?" con la fuente por defecto de
  dompdf - misma limitación ya documentada en
  `pdf/contractions.blade.php` para el icono de rayo/el carácter "●" -,
  así que se quitaron, texto plano en su lugar. Con esos dos arreglos,
  el degradado (`linear-gradient`) y los dos círculos decorativos
  traslúcidos que sí lleva la tarjeta en pantalla (`position: absolute`
  dentro de un contenedor `position: relative`, recortados por el
  `border-radius` de la tarjeta) renderizan bien en esta versión de
  dompdf - confirmado con la misma captura con Ghostscript. `vitamin_d`
  (`has_schedule`/`given`/`total_days`, `required|array` - a diferencia
  de `weekly_trend`/`activity_heatmap`, siempre llega relleno, nunca un
  array vacío: `has_schedule:false` es el estado "nunca activado") se
  añadió igual, sección propia en el PDF entre la comparativa semanal
  y "Crecimiento" - ver `VitaminDScheduleController`/
  `VitaminDDoseController` más abajo para el resto de la feature.
  `weekly_sleep_by_day` (7 entradas fijas `date`+`hours`, `present` no
  `required` en el array exterior pero cada campo interno sí
  `required` - siempre las 7, nunca una lista vacía, a diferencia de
  `weekly_trend`/`activity_heatmap`) alimenta "Sueño esta semana" -
  movido aquí desde el Dashboard (`WeeklySleep.vue`, ver
  `web/README.md`), por lo que el PDF pasó a necesitar estos datos que
  antes no exportaba en absoluto. `StatsExportController::dailySleepPoints()`
  etiqueta cada día por su nombre corto (`CarbonImmutable::translatedFormat('D')`,
  "lun.") y reutiliza el mismo partial de barras verticales que
  "Tendencia semanal", con el día de hoy resaltado. `buildStatsExportPayload()`
  pasó de 8 parámetros posicionales a un único objeto de opciones
  (`StatsExportOptions`) con esta feature - quedó anotado en el propio
  código del frontend que la siguiente estadística exportable era el
  punto natural para ese cambio.
- `app/Http/Controllers/VitaminD/VitaminDScheduleController.php` +
  `VitaminDDoseController.php` — recordatorio diario de vitamina D,
  por bebé (`PUT /babies/{baby}/vitamin-d-schedule`,
  `GET`/`PUT /babies/{baby}/vitamin-d-doses`). Dos tablas separadas en
  vez de una, mismo criterio que `growth_measurements`/`milestones`:
  `baby_vitamin_d_schedules` es la configuración vigente, una fila por
  bebé (`baby_id` `unique()`, reutilizada vía `updateOrCreate()` al
  reactivar/reeditar en vez de crear una nueva fila), mientras que
  `baby_vitamin_d_doses` es el histórico real, `unique(['baby_id',
  'date'])` como clave natural - marcar o corregir un día es el mismo
  `updateOrCreate()`, nunca una fila duplicada. El histórico nunca se
  borra, ni al desactivar el recordatorio ni al pasar `end_date`: es
  lo que luego lee `summarizeVitaminDStats()` en el frontend para la
  sección "Vitamina D" de Estadísticas/PDF, incluso de una pauta ya
  terminada. `VitaminDScheduleController::show()` devuelve también
  `recent_doses` (últimos 14 días embebidos en la misma respuesta,
  para que el editor retroactivo del Dashboard no tenga que pedir cada
  día suelto); `GET /vitamin-d-doses` (sin el recorte) es solo para
  Estadísticas, que necesita el histórico completo para calcular
  "dadas/días transcurridos". `UpsertVitaminDDoseRequest` valida en
  `withValidator()` (no una regla de cadena simple) que exista una
  pauta activa y que la fecha no sea anterior a `start_date` -
  depende del propio `Baby` de la ruta, no de otro campo del payload.
  `date` usa `before_or_equal:tomorrow`, no `:today` - el servidor
  corre en UTC (`config('app.timezone')`), y "hoy" es el día de
  calendario del cuidador, no el del servidor; justo después de
  medianoche en España, en UTC todavía es el día anterior, así que
  comparar contra el "hoy" del servidor rechazaba como "fecha futura"
  la fecha de hoy real del cuidador (bug real encontrado en vivo,
  confirmado consultando `now()` del servidor en el momento exacto del
  fallo). Un día de margen cubre cualquier huso horario real (máximo
  UTC+14) sin abrir la puerta a marcar un día genuinamente lejano.
- `ContractionController@destroyAll` — `DELETE
  /babies/{baby}/contractions` (sin el segmento `{contraction}` del
  borrado individual), autorizado igual que `destroy()`. Borra todas
  las contracciones del bebé de golpe; pensado para una falsa alarma
  con contracciones de práctica que no vale la pena conservar fila por
  fila.
- `TimelineController@index` gana un parámetro `date` (YYYY-MM-DD)
  opcional que cambia el modo de consulta por completo: en vez de "las
  `$limit` más recientes por tipo" (el modo que usa el sondeo del
  dashboard cada 15 s), devuelve todo lo que se solape con ese día
  concreto, sin límite — un solo día nunca acumula demasiadas filas. El
  rango empieza un día antes del solicitado para no cortar un sueño que
  empezó la noche anterior; el recorte exacto a `[00:00, 24:00)` ya lo
  hacía el frontend (`DailyRhythm.vue`), este parámetro solo le da algo
  más de margen con el que trabajar. Usado por la navegación a días
  anteriores de "Ritmo de hoy" (ver `web/README.md`).

## Seguridad y privacidad

Medidas del API, con el motivo de cada una:

- **CORS con caché de preflight** (`config/cors.php`, `max_age => 7200`): con
  `0` el navegador repetía la petición OPTIONS antes de **cada** llamada con
  `Authorization` (125-280 ms medidos en producción).
- **IP real del cliente** (`App\Http\Middleware\ResolveClientIp`): detrás de
  Render el servidor solo veía la IP de su proxy, así que el límite de login
  era un único cubo compartido por todos. En producción se toma de
  `CF-Connecting-IP` (Cloudflare la pisa, no la puede falsificar el cliente);
  `X-Forwarded-For` no se usa porque su primer valor lo escribe el cliente.
  Fuera de producción se ignora.
- **Sesiones:** los tokens de Sanctum caducan a los 120 días
  (`SANCTUM_EXPIRATION`, en minutos), cambiar la contraseña cierra las demás
  sesiones (se conserva la actual) y restablecerla cierra todas.
- **Límites de peticiones** con limitadores con nombre y clave propia
  (`AppServiceProvider`): `api` (300/min por usuario, solo frena abusos) y
  `exports` (10/min, los PDF gastan CPU). Los `throttle:N,1` sin nombre
  comparten contador entre sí, así que apilar uno general con uno específico
  contaría cada petición dos veces y recortaría el límite a la mitad; por eso
  los nuevos van con nombre. Los listados de registros se acotan a 20.000
  filas (`Controller::INDEX_LIMIT`).
- **Los contadores de los límites van a un fichero, no a la base de datos**
  (`CACHE_LIMITER_STORE`, `config/cache.php`, por defecto `file`). Medido: con
  `CACHE_STORE=database`, una petición autenticada pasaba de 5 a 11 consultas
  SQL (el límite general lee y escribe su contador en cada petición, también en
  cada sondeo del Dashboard), todas contra Neon. En un fichero sobrevive entre
  peticiones y solo se pierde al reiniciar la instancia, irrelevante para un
  freno de abusos. Pruebas y e2e fijan `array`. No sirve `array` en producción:
  con `php artisan serve` cada petición es un ciclo nuevo y el contador no
  persistiría.
- **Cabeceras** (`SecurityHeaders`): `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options` y HSTS; `expose_php = Off`
  (`docker/security.ini`) quita `X-Powered-By: PHP/x.y.z`.
- **Idioma de los errores** (`SetLocaleFromRequest`): el API contesta en el
  idioma de la cabecera `Accept-Language` (`es` o `en`; con otro valor o sin
  ella, `APP_LOCALE`). Los textos en español van envueltos en `__()` y su
  traducción está en `lang/en.json`; un test falla si algún texto envuelto no
  tiene traducción. Los PDF siguen solo en español.
- **Datos de la cuenta (RGPD):** `DELETE /api/user` (pide la contraseña actual)
  borra la cuenta: los bebés que solo cuidaba esa persona se borran con su
  historial y sus fotos, y los compartidos se quedan para el otro cuidador,
  con lo que la persona había anotado (los registros pierden el autor,
  `user_id` es `nullable` + `nullOnDelete`). `GET /api/user/export` devuelve
  todo lo de la cuenta en un JSON, sin contraseña, sin tokens, sin los emails
  de otros cuidadores y sin las fotos (solo si había).
- **Contraseñas y verificación de email:** mínimo de 8 caracteres
  (`AppServiceProvider`, solo para contraseñas nuevas). La verificación está
  construida y **apagada** (`REQUIRE_EMAIL_VERIFICATION`, `config/auth.php`):
  el correo lleva a la página `/verify-email` de la SPA con una firma
  **relativa** (`signed:relative`, sin host, porque detrás de Render el
  esquema/host que ve el servidor puede no ser el público); la SPA reenvía los
  parámetros a `GET /api/email/verify/{id}/{hash}`, que no pide sesión.
  `POST /api/email/verification-notification` reenvía el correo. Con la
  variable en `true`, `EnsureEmailIsVerifiedWhenRequired` responde 403
  `email_unverified` en `api/babies...` a quien no ha confirmado (el perfil,
  cerrar sesión, descargar los datos y borrar la cuenta siguen disponibles).
  **No encenderla sin un dominio verificado en Resend**: el sandbox
  (`onboarding@resend.dev`) solo entrega al dueño de la cuenta. Las cuentas
  anteriores se marcan como confirmadas por migración, y el registro no falla si
  el correo no sale.

  **Cómo encenderla cuando haya dominio propio** (el código no cambia, todo es
  configuración):
  1. En Resend, *Domains → Add domain* (vale un dominio o un subdominio, p. ej.
     `mail.midominio.com`) y copiar los registros DNS que indica (SPF, DKIM y
     MX) en el panel DNS del dominio. Esperar a que figure como *Verified*.
  2. En Render, variables de entorno: `MAIL_MAILER=resend`, `RESEND_API_KEY`,
     `MAIL_FROM_ADDRESS` con una dirección de ese dominio (p. ej.
     `PequeDex <no-reply@mail.midominio.com>` se separa en
     `MAIL_FROM_ADDRESS=no-reply@mail.midominio.com` y
     `MAIL_FROM_NAME=PequeDex`).
  3. **Comprobar antes de encender** que llega un correo real a una cuenta
     distinta de la del dueño de Resend (p. ej. con *Olvidé mi contraseña*).
  4. Poner `REQUIRE_EMAIL_VERIFICATION=true` en Render y redesplegar. Si se
     quiere probar antes, se puede encender primero en local con
     `MAIL_MAILER=log` y leer el enlace en `storage/logs`.
  Alternativa sin dominio, descartada por ahora: la API de Gmail por HTTPS
  (la usa LudoDex, `GmailApiTransport`), cuyo token caduca cada 7 días con el
  consentimiento OAuth en modo *Prueba*.
- **Dependencias:** Dependabot (`.github/dependabot.yml`, semanal) y sus
  actualizaciones de seguridad activadas; `composer audit` y
  `npm audit --omit=dev` limpios. Quedan avisos en `braces`/`micromatch`
  dentro de la configuración de ESLint: solo herramienta de desarrollo.

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
  persistente. **El bucket está en privado** (sin "Public Development
  URL" habilitada ni ningún Custom Domain asignado en Cloudflare — solo
  accesible vía la API S3 firmada), confirmado en el propio panel de R2.
  `Milestone::photoUrl()` pide una URL firmada de corta duración cuando
  el disco lo soporta — eso era lo único que faltaba, ya que R2 no tiene
  ACL por objeto como S3: con el bucket público, cualquiera que conociera
  la ruta del archivo se habría saltado la firma por completo.
- `SESSION_DRIVER`/`CACHE_STORE`/`QUEUE_CONNECTION` a `database` (no hay
  Redis ni *worker* en el plan Free).
- `SENTRY_LARAVEL_DSN` (opcional, vacía por defecto — sin ella el SDK no
  hace nada): monitorización de errores en producción vía
  [Sentry](https://sentry.io) (plan gratuito), cableada en
  `bootstrap/app.php` (`Sentry\Laravel\Integration::handles()`) — mismo
  patrón ya en marcha en MIRA_MarketLens y LudoDex. `traces_sample_rate`
  se deja sin definir a propósito (`config/sentry.php` cae a `null`, sin
  tracing de rendimiento) — solo interesan los errores.
- `FRONTEND_URL` (la URL pública de la SPA en GitHub Pages): a dónde
  apunta el enlace del correo de restablecer contraseña — esta API no
  tiene ninguna ruta web renderizada donde llevarlo.
- `MAIL_MAILER=resend`, `RESEND_API_KEY` y `MAIL_FROM_ADDRESS` (remitente
  sandbox `onboarding@resend.dev` por ahora, sin dominio propio
  verificado todavía): `resend/resend-php` envía correo transaccional vía
  la API HTTPS de [Resend](https://resend.com), no SMTP — Render bloquea
  las conexiones SMTP salientes por completo, mismo patrón que
  MIRA_MarketLens/LudoDex. Hasta ahora esta app no tenía ninguna función
  de email real (la vinculación de cuidadores usa un código de
  invitación, no un enlace por correo); el restablecimiento de contraseña
  es la primera.

El *deploy hook* de Render se dispara desde GitHub Actions
(`.github/workflows/ci.yml`, secret `RENDER_DEPLOY_HOOK_URL`) tras pasar
tests/lint/build de ambas apps, no desde el webhook nativo de Render —
mismo arreglo ya aplicado en LudoDex tras encontrar ahí que el webhook
nativo se perdía deploys de forma intermitente.
