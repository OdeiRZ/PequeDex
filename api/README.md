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
  se guarda como `data:` URI en `users.avatar` (columna `text`), no como
  archivo en disco — a diferencia de la foto de un hito (ver más abajo),
  aquí no hace falta R2: es una imagen pequeña (`AvatarProcessor`,
  GD puro, la redimensiona a 320×320 como máximo) y una columna evita
  depender de nada externo solo para esto. Sin errores por campo en la
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
- `app/Models/Baby.php` / `app/Policies/BabyPolicy.php` — el recurso
  compartido entre cuidadores (tabla pivote `baby_user`, sin distinción
  admin/no-admin: cualquier cuidador vinculado tiene acceso total de
  lectura/escritura). `FeedController`/`SleepController`/
  `DiaperChangeController` autorizan siempre contra el `Baby` padre
  (`$this->authorize('update', $baby)`), nunca contra el `user_id` de la
  fila que se está editando — el campo `user_id` en `feeds`/`sleeps`/
  `diaper_changes` es solo trazabilidad de quién lo registró, nunca se
  usa para decidir quién puede verlo o editarlo.
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
- `SleepController::index` admite un parámetro opcional `?since=` para
  acotar a una ventana reciente en vez de traer el historial completo
  del bebé — lo usa el gráfico semanal de sueño del frontend (ver
  `web/README.md`), que no necesita más que los últimos días. Antes no
  tenía ningún límite (a diferencia de `TimelineController`, que ya
  acotaba sus tres subconsultas desde el principio). El filtro
  comprueba `started_at`, `ended_at` o `ended_at IS NULL` — no solo
  `started_at` — para no perder un sueño que empezó antes de la
  ventana pero sigue en curso o terminó dentro de ella.
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
  El dashboard sondea este endpoint cada 5 segundos mientras está
  abierto, así que sin este límite por subconsulta el coste crecía con
  el histórico completo del bebé en vez de con lo que se muestra.
- `app/Services/Sleep/SleepPatternPredictor.php` — predicción de patrones
  de sueño deliberadamente honesta: una media móvil sobre el propio
  historial de siestas del bebé (ventana de vigilia media, duración
  media), no un modelo entrenado ni una tabla de edades. Por debajo de 3
  siestas completas en el historial, devuelve `has_enough_data: false`
  en vez de una predicción inventada con tan pocos datos.
- `app/Services/Feeds/FeedPatternPredictor.php` — misma idea que el de
  sueño, aplicada a tomas: media móvil del hueco entre tomas del propio
  bebé. Más simple que el de sueño porque una toma es un instante
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
  evento aparte.
- `ContractionController@destroyAll` — `DELETE
  /babies/{baby}/contractions` (sin el segmento `{contraction}` del
  borrado individual), autorizado igual que `destroy()`. Borra todas
  las contracciones del bebé de golpe; pensado para una falsa alarma
  con contracciones de práctica que no vale la pena conservar fila por
  fila.
- `TimelineController@index` gana un parámetro `date` (YYYY-MM-DD)
  opcional que cambia el modo de consulta por completo: en vez de "las
  `$limit` más recientes por tipo" (el modo que usa el sondeo del
  dashboard cada 5s), devuelve todo lo que se solape con ese día
  concreto, sin límite — un solo día nunca acumula demasiadas filas. El
  rango empieza un día antes del solicitado para no cortar un sueño que
  empezó la noche anterior; el recorte exacto a `[00:00, 24:00)` ya lo
  hacía el frontend (`DailyRhythm.vue`), este parámetro solo le da algo
  más de margen con el que trabajar. Usado por la navegación a días
  anteriores de "Ritmo de hoy" (ver `web/README.md`).

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
