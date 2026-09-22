# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este
proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- Micro-animaciones nuevas en tres botones que antes solo cambiaban de
  color: el de eliminar de la línea temporal (la tapa del icono de
  cubo se abre al pasar el ratón, como aviso pasivo antes de pulsar,
  más un squish al hacerlo — explorado antes en un boceto interactivo
  con tres propuestas comparadas en contexto), el botón primario (un
  brillo diagonal cruza una vez al hover), y cada acceso de la barra
  principal (el icono se inclina y el círculo sube ligeramente al
  pasar el ratón, sin ningún feedback antes). Todas respetan
  `prefers-reduced-motion`.
- Las predicciones de próxima toma/próximo sueño se mueven de un
  recuadro destacado al final del dashboard a justo debajo de las
  estadísticas de hoy, con el mismo aspecto que una fila de la línea
  temporal (mismo componente `EntryCard`) en vez de un bloque visual
  aparte — la pregunta de "¿cuándo toca lo siguiente?" queda arriba,
  donde se mira primero, no enterrada bajo el ritmo y el historial.
  Nuevo interruptor "Predicciones" en "Tu cuenta" (junto a la barra de
  accesos, mismo guardado al vuelo con reversión si falla) para
  desactivarlas por completo si no se quieren ver — activadas por
  defecto. Nueva columna `users.predictions_enabled`.
- Iconos de toma, sueño, pañal y hito renovados — los cinco eran trazos
  finos genéricos sin nada propio de un bebé real. Explorados en dos
  bocetos comparados antes de aplicarlos: biberón de trazo grueso con
  la línea del nivel de leche (toma), luna llena rellena con dos
  destellos en vez de solo el contorno (sueño), funda redondeada con
  el pliegue lateral (pañal), y la misma estrella de hito redibujada
  con las puntas más largas — una estrella de 5 puntas ocupa menos
  área real que un círculo o rectángulo de la misma caja por sus
  huecos cóncavos, así que a igual altura siempre leía más pequeña que
  el resto. Crecimiento se queda igual: de varias alternativas
  exploradas (regla, báscula, barras...) ninguna mejoraba a la actual.
- "Línea temporal" del dashboard, hasta ahora un listado plano sin
  ninguna referencia al día de cada entrada, gana separadores de día
  (misma píldora visual que ya usaba el listado de contracciones) y
  pasa a filtrarse por fecha: mientras "Ritmo de hoy" está en "hoy"
  muestra lo más reciente agrupado por día (útil porque esa vista
  puede alcanzar entradas de ayer una vez se acumulan suficientes
  hoy), y al navegar a un día anterior con las flechas de esa misma
  sección, la lista se filtra a solo las entradas de ese día concreto
  — ambas secciones comparten ahora la misma navegación por día, en
  vez de un segundo selector duplicado. Las predicciones de próxima
  toma/próximo sueño se ocultan al navegar a un día pasado, ya que son
  una estimación relativa a "ahora" sin sentido sobre un día ya
  cerrado.
- El PDF de contracciones gana cabecera y pie de página con los datos
  más relevantes del historial completo: fecha/hora de generación y una
  barra con tres estadísticas (contracciones totales, duración media,
  intervalo medio — este último excluye los huecos "> 60 min", que no
  son un intervalo real entre labores, igual que en la tabla) en la
  cabecera; nombre de la app con su logo en el pie, repetido en cada
  página. La rotura de bolsa de aguas, que antes no aparecía en el PDF
  en absoluto, se muestra ahora como una fila más dentro de la línea
  temporal, en el hueco cronológico exacto que le corresponde entre las
  contracciones (mismas columnas que el resto de filas: icono alineado
  con el número, fecha con "Inicio de contracción", texto centrado en
  el resto del ancho) — en azul en vez del marrón de marca del resto
  del documento, para que se distinga como un evento aparte, no una
  estadística más.
- Navegación por día en "Ritmo de hoy": flechas para ver el ritmo y las
  tomas de días anteriores (la de avanzar se desactiva en "hoy" — nunca
  se navega al futuro). Antes `DailyRhythm.vue` estaba fijo al día
  actual y el propio endpoint de línea temporal solo sabía devolver "las
  N entradas más recientes en total", sin forma de pedir un día
  concreto. `TimelineController@index` gana un parámetro `date`
  opcional que cambia a ese modo (sin el límite habitual, con el rango
  empezando un día antes para no cortar un sueño que empezó la noche
  anterior); mientras se ve "hoy" el dashboard sigue leyendo del sondeo
  normal, sin tocarlo. Nuevo `lib/localDate.ts` para aritmética de
  fechas en hora local, no UTC — necesario para que la fecha "hoy"/"día
  siguiente" no se desincronice cerca de medianoche según la zona
  horaria del navegador.
- Contador de contracciones: nuevo botón "Eliminar todas las
  contracciones" en los ajustes del bebé (junto a "Abandonar este
  bebé", mismo patrón de confirmación de dos pasos), útil tras una
  falsa alarma para borrar contracciones de práctica sin conservarlas
  fila por fila. Solo visible antes de que nazca el bebé, como el resto
  de esta funcionalidad.
- Contador de contracciones: la hoja de edición deja ajustar los
  segundos de inicio/fin, no solo el minuto — importa para
  contracciones que de verdad duran segundos, no minutos enteros
  (nueva `toLocalInputValueWithSeconds()` + `step="1"`, solo en estos
  dos campos; el resto de formularios del dashboard se quedan con
  precisión de minuto, no tiene sentido ahí). El umbral de "intervalo
  demasiado largo" sube de 50 a 60 minutos, tanto en la app como en el
  PDF exportado — una hora es un corte más natural que el 50 heredado
  tal cual de la app de referencia. "Desde la última: mm:ss" deja la
  barra flotante inferior (quedaba lejos de la contracción a la que se
  refiere) y pasa a mostrarse justo encima de la fila más reciente de
  la línea temporal — en la misma píldora con borde, alineada a la
  derecha, que ya usan los chips de intervalo entre contracciones, en
  vez de texto centrado aparte. Al superar el umbral de 60 minutos deja
  de mostrar el contador creciendo y fija el texto en "> 60 min" (el
  tiempo transcurrido sigue calculándose por debajo, solo deja de
  cambiar lo que se ve). Ajuste posterior: quedaba pegada al separador
  de día en vez de a la fila de la contracción cuando esta era de un
  día anterior a "ahora" — se traslada de `ContractionsView.vue` a
  `ContractionTimeline.vue` para que quede siempre sobre el bloque
  correcto, sin depender de dónde caiga el separador.

- Contador de contracciones: el tiempo desde la última contracción se
  ve ahora en vivo ("Desde la última: mm:ss", creciendo cada segundo)
  sobre el botón de inicio, en vez de aparecer solo como una etiqueta
  estática en la línea temporal una vez arrancaba la siguiente
  contracción. Pedido explícito, mejora sobre el original (que no lo
  mostraba en ningún momento antes del hecho). Desaparece mientras hay
  una contracción en marcha y vuelve a empezar desde cero en cuanto se
  detiene, repitiendo el ciclo — puramente derivado del `ended_at` de
  la última contracción y el reloj compartido de la vista, sin dato
  nuevo que guardar.

- Contador de contracciones, calcado (adaptado a la identidad visual de
  PequeDex) de una app de referencia: cronómetro de inicio/detener con
  estadísticas sobre la última hora (veces por hora, duración e
  intervalo medios), línea temporal con número secuencial, intensidad
  en 3 niveles (Leve/Moderada/Intensa — el original tenía 4) y edición
  de cada contracción; registro de rotura de bolsa de aguas con fecha y
  hora completas y editables (mejora sobre el original, que solo
  mostraba la hora y no dejaba corregirla); exportación a PDF agrupada
  por día. Vive en `/contracciones`, enlazada desde una tarjeta en el
  dashboard que solo aparece mientras el bebé no ha nacido
  (`birth_date` vacío) — desaparece sola en cuanto se rellena. Nueva
  tabla `contractions` y columna `babies.water_broke_at`. Traducido a
  español e inglés desde el primer commit.

  Pasada de pulido visual sobre la primera versión, acercando el
  diseño a la app de referencia: filas de la línea temporal en forma
  de píldora (hora y número de contracción grandes junto a un círculo
  conectado por una línea gruesa, duración e intensidad más discretas
  dentro de la píldora), separador de día con fecha completa entre
  grupos, chip de intervalo alineado a la derecha, y los botones de
  inicio/detener y rotura de bolsa flotando fijos sobre el historial
  en vez de ir en el flujo normal de la página. También corrige un
  bug real encontrado durante las pruebas: el backend omitía la clave
  `ended_at` en la respuesta al crear una contracción (en vez de
  mandar `null`), así que el botón de inicio/detener se quedaba
  atascado en "Inicio de contracción" y la duración media mostraba
  "NaN:NaN" mientras una contracción seguía en marcha.

  El PDF exportado recibió el mismo tratamiento: filas tipo tarjeta en
  vez de tabla con rayado alterno, cabeceras "Inicio/Fin de
  contracción" como el original, intervalo en píldora con borde, e
  intensidad mostrada con el mismo icono de rayo que la app (no un
  número ni un carácter Unicode — dompdf no renderiza ni `<svg>`
  inline ni "●" con la fuente por defecto; sí renderiza un `<img
  src="data:image/svg+xml;base64,...">`, así que el rayo se genera una
  vez por exportación como dos *data URIs* y se pasa a la vista).

- Soporte real para varios bebés por cuidador (p. ej. un hijo ya
  nacido y un segundo embarazo en marcha a la vez) — el backend ya lo
  permitía (`baby_user` es una tabla pivote de muchos-a-muchos), pero
  el frontend siempre cogía el primero de la lista y no había forma de
  cambiar. Ahora `babies.ts` guarda la lista completa y cuál está
  activo, persistido en `localStorage` (`pequedex_active_baby`) para
  que sobreviva a un recargo de página. Un selector de chips aparece
  sobre la cabecera solo cuando hay más de un bebé (cero ruido visual
  para el caso normal de uno solo), y "Añadir otro bebé" desde los
  ajustes del bebé actual abre los mismos formularios de crear/unirse
  del arranque inicial, ahora también disponibles con un bebé ya
  activo. Al abandonar un bebé, cae al siguiente que quede en vez de
  volver siempre a la pantalla de "empieza con tu bebé".

- Segunda pasada de estilo, esta vez estructural en vez de solo
  micro-interacciones: `TodaySummary.vue`, una fila de estadísticas
  ("4 tomas hoy", "2h de sueño hoy", "3 pañales hoy") justo bajo la
  cabecera del bebé, con relleno sólido del color de cada categoría y
  cifras grandes — el primer sitio de la página con jerarquía
  tipográfica real, no solo texto de un mismo tamaño apilado. El fondo
  de `body` pasa de un tono plano único a dos veladuras radiales fijas
  en los colores de marca (`color-mix`, muy tenues), para que las
  tarjetas lean como si flotaran en vez de fundirse con el fondo.
  Los títulos de sección sueltos (Hitos, Línea temporal, Crecimiento)
  ganan una barra de acento de color junto al texto, rompiendo la
  monotonía de secciones idénticas apiladas verticalmente.

- Predicción de la siguiente toma, misma idea honesta que la de sueño:
  media móvil del hueco entre las tomas del propio bebé
  (`FeedPatternPredictor`), sin datos inventados por debajo de 3 tomas
  registradas. Nueva tarjeta "Toma: predicción" en el dashboard, junto
  a la de sueño, respetando la barra de accesos personalizable (no
  aparece si la categoría "toma" está desactivada).

- Pasada de pulido visual e interactivo inspirada en LudoDex/MIRA
  MarketLens (adaptada a esta app, no copiada literal — ninguna de las
  dos usa Tailwind): toasts con icono y color por tipo
  (éxito/error, antes un único verde para ambos), una celebración de un
  solo disparo en la marca del encabezado tras un guardado correcto,
  tarjetas de la línea temporal con elevación/anillo de color al pasar
  el ratón y una animación de entrada/salida (`TransitionGroup`) al
  añadir o borrar una, barras de "Sueño esta semana" con crecimiento y
  brillo al pasar el ratón (el día de hoy con un anillo propio), marcas
  de "Ritmo de hoy" con tooltip nativo (hora exacta) y crecimiento al
  pasar el ratón, y retroalimentación táctil (elevación/escala) en
  botones, hitos y tarjetas en general. Todo con reserva para
  `prefers-reduced-motion: reduce`.

- Barra de accesos rápidos personalizable desde "Tu cuenta": cada
  usuario elige qué categorías (toma, sueño, pañal, medida, hito) quiere
  ver en la barra inferior del dashboard, con un mínimo de 3 — al
  desmarcar una categoría también desaparecen sus bloques asociados
  (p. ej. "Sueño esta semana" y la predicción si se desactiva sueño,
  la lista de medidas si se desactiva crecimiento). Cada categoría es
  un icono-toggle (relleno sólido + marca de verificación si está
  activa, contorno gris si no), guardado al vuelo sin bloquear el
  resto de iconos mientras se guarda. Con menos de 5 seleccionadas, la
  barra real del dashboard agranda los iconos restantes de forma
  notable (32px → 44px → 56px) en vez de dejar hueco vacío. Nueva
  columna `action_bar_categories` (JSON nullable, `null` = las 5
  visibles) en `users`.

- Monitorización de errores en producción vía Sentry (plan gratuito,
  `sentry/sentry-laravel`), cableada en `bootstrap/app.php`
  (`Sentry\Laravel\Integration::handles()`) — mismo patrón ya en marcha
  en MIRA_MarketLens y LudoDex, replicado aquí tras revisar los tres
  proyectos del mismo workspace de Render en busca de huecos parecidos.
  Sin `SENTRY_LARAVEL_DSN` puesta (vacía por defecto) el SDK no hace
  nada, en ningún entorno. `traces_sample_rate` se deja sin definir a
  propósito — solo errores, sin gastar cuota del plan gratuito en
  tracing de rendimiento.

- `resend/resend-php` instalado por adelantado (mismo SDK que ya usan
  MIRA_MarketLens y LudoDex para enviar correo transaccional vía su API
  HTTPS, no SMTP — Render bloquea las conexiones SMTP salientes por
  completo, confirmado en vivo en esos dos proyectos), aunque esta app
  todavía no tiene ninguna función de email real (la vinculación de
  cuidadores usa un código de invitación, no un enlace por correo) que
  lo necesite. Sin `RESEND_API_KEY` puesta, esto no cambia nada del
  comportamiento actual.

- Cimientos: repo, API en Laravel 12 + Sanctum (registro/login/logout por
  token Bearer) y SPA en Vue 3 + TypeScript con las mismas pantallas,
  verificado de punta a punta en local (registro real → sesión persiste
  tras recargar → cierre de sesión).

- Modelo de datos del núcleo de la app: un `Baby` compartido entre varios
  cuidadores (tabla `baby_user`, mismo patrón que `familia_user` en MIRA
  MarketLens, pero sin distinción admin/no-admin — cualquier cuidador
  vinculado tiene acceso total). Vinculación por código de invitación
  corto (8 caracteres, sin 0/O/1/I para evitar confusiones al copiarlo a
  mano): al crear un bebé se genera uno, y cualquier otro usuario puede
  unirse introduciéndolo, sin necesitar infraestructura de email
  todavía. Tomas (`feeds`), sueño (`sleeps`) y pañales (`diaper_changes`)
  como tres tablas tipadas (no una tabla `events` polimórfica) para que
  las estadísticas que se quieren más adelante (intervalo medio entre
  tomas, duración media de sueño) puedan hacerse con columnas reales,
  no un JSON por fila. Endpoint de "línea temporal"
  (`GET /babies/{baby}/timeline`) que mezcla y ordena los tres tipos en
  una sola lista, para que el dashboard no tenga que hacer 3 peticiones
  y mezclarlas a mano. Verificado de punta a punta contra la API real
  (sin pantallas todavía): un cuidador crea el bebé y registra una toma,
  un segundo cuidador se une con el código y ve/edita esa misma toma, un
  tercero sin el código recibe 403.

- Primeras pantallas: crear un bebé o unirse con un código de invitación,
  y un dashboard con registro rápido de toma/sueño/pañal (formularios
  precargados con la hora actual) y una línea temporal combinada.
  Sincronización entre cuidadores por sondeo cada 5 segundos, mismo
  patrón que el import de BGG en LudoDex — sin websockets ni
  infraestructura nueva. Sin diseño todavía (ver la nota de arquitectura
  en `web/README.md`). Verificado de punta a punta en el navegador
  contra la API real: registro → crear bebé → registrar toma/sueño/pañal
  → aparecen en la línea temporal → borrar una entrada → recargar la
  página mantiene la sesión y el resto de entradas.

- Crecimiento con percentiles OMS: `GrowthMeasurement` (peso, talla y
  perímetro craneal, cada uno opcional pero con al menos uno requerido)
  decorado al vuelo con el percentil correspondiente según las tablas
  oficiales de la OMS (Child Growth Standards, método LMS), usando los
  datos reales de peso/talla/perímetro craneal por edad y sexo
  publicados por la OMS (0–24 meses) — no una aproximación, los números
  se descargaron de `cdn.who.int` y se verificaron contra puntos de
  referencia conocidos (un valor exactamente en la mediana da percentil
  50). El `Baby` ahora admite `sex` y `birth_date`, ambos opcionales: si
  falta cualquiera de los dos, el percentil simplemente no se calcula
  (queda a `null`) en vez de fallar. La edad para la tabla se calcula
  con el mismo "mes medio" de 30.4375 días que usa la propia OMS, no el
  mes de calendario.

- Hitos con foto: `Milestone` (título, fecha y descripción opcional)
  con subida real de archivo — a diferencia del `image_url` de LudoDex
  (que funciona porque la carátula de un juego tiene una fuente externa,
  BGG), la foto de un hito no tiene de dónde sacarse por URL, así que se
  sube el archivo directamente al disco `public` de Laravel. Reemplazar
  la foto borra la anterior; también se puede quitar sin subir una
  nueva. Verificado de punta a punta contra la API real: subida de una
  imagen real, comprobación de que el archivo queda en
  `storage/app/public/milestones/{baby}/` y que la URL servida
  (`photo_url`) apunta a él.

- Ambas funcionalidades comparten el mismo modelo de autorización que
  tomas/sueño/pañales (cualquier cuidador vinculado al bebé puede ver y
  editar, sin importar quién lo registró) y quedan cubiertas por tests
  Pest (15 tests nuevos, incluyendo el cálculo de percentiles y el
  ciclo de vida completo de la foto de un hito).

- Predicción de patrones de sueño (`GET /babies/{baby}/sleep-prediction`),
  estilo Huckleberry "SweetSpot" pero deliberadamente simple y honesto:
  no es machine learning, es una media móvil del propio historial del
  bebé (ventana de vigilia media entre siestas, duración media de
  sueño), calculada solo sobre sus últimos registros reales. Con menos
  de 3 siestas completas registradas devuelve explícitamente "datos
  insuficientes" en vez de inventar una predicción. Si hay una siesta en
  curso, predice la hora de despertar; si la última ya terminó, predice
  la hora de la siguiente siesta.

- Pantallas para crecimiento, hitos y predicción de sueño: formularios de
  registro rápido de medida (peso/talla/perímetro craneal, con su
  percentil OMS) y de hito (con subida de foto), un ajuste de sexo/fecha
  de nacimiento del bebé (necesarios para el percentil), sus listas
  correspondientes, y el aviso de predicción de la siguiente siesta o
  la hora de despertar. Verificado de punta a punta en el navegador
  contra la API real: crear el bebé, fijar sexo y fecha de nacimiento,
  registrar una medida y ver su percentil, subir una foto real en un
  hito y verla servida.

- Dos fallos de configuración encontrados en esa verificación real (no
  visibles en los tests, que no sirven archivos por HTTP): faltaba
  `php artisan storage:link` en las instrucciones de instalación (sin
  él, la foto de un hito da 403 aunque el archivo exista en disco), y
  el `APP_URL` de ejemplo (`http://localhost`, sin puerto) no coincide
  con el puerto real de `php artisan serve`, lo que rompe la URL
  servida de la foto (`photo_url`) en cualquier instalación por
  defecto. Corregidos ambos en `api/.env.example` y documentados en
  `api/README.md`.

- Español (por defecto) e inglés con `vue-i18n`, en vez de los 5 idiomas
  de LudoDex/MIRA: las dos personas que usan la app a diario hablan
  español (sigue siendo el idioma real), el inglés es para quien la
  mire desde el portfolio. Selector de idioma (`LanguageSwitcher.vue`)
  visible en cualquier pantalla, con la elección persistida en
  `localStorage`. Los valores de los enums del backend (lado de la
  toma, tipo de pañal) se traducen en el punto de uso porque son datos
  internos en español, no texto de interfaz.

- Identidad visual con Tailwind CSS v4: paleta cálida propia (marca en
  rosa empolvado + verde azulado, un color semántico por categoría de
  registro — no decorativo, para escanear la línea temporal por color e
  icono), tipografía Quicksand para titulares, y modo claro/oscuro/
  sistema persistido (el oscuro no es un capricho: es para las tomas de
  madrugada). Interacción mobile-first: barra de acciones fija alcanzable
  con el pulgar que abre una hoja inferior por encima del contenido en
  vez de un formulario que empuje la página, y controles segmentados en
  vez de `<select>` para tipo de toma/pañal/sexo. Campo de contraseña
  con icono de mostrar/ocultar en login, registro y su confirmación.
  Diseñado primero como propuesta visual (paleta, tipografía, layout) y
  aprobado antes de tocar el código real. Verificado de punta a punta en
  el navegador en ambos temas e idiomas.

- Despliegue real: API en [Render](https://render.com) (Docker, Frankfurt)
  + Postgres en [Neon](https://neon.tech) (Londres) + fotos de hitos en
  [Cloudflare R2](https://developers.cloudflare.com/r2/) + frontend en
  [Cloudflare Pages](https://pages.cloudflare.com), mismo patrón que
  LudoDex/MIRA MarketLens. El *deploy hook* de Render se dispara desde
  GitHub Actions tras pasar tests/lint/build (`RENDER_DEPLOY_HOOK_URL`),
  no desde su webhook nativo — mismo arreglo que ya hizo falta en LudoDex.
  Verificado de punta a punta contra los servicios reales: registro,
  crear un bebé, y subida de una foto de hito que efectivamente aparece
  servida desde el dominio público de R2.

- Un `_redirects` con `/* /index.html 200` para el *fallback* de SPA en
  Cloudflare Pages resultó innecesario y, de hecho, activo un aviso de
  "bucle infinito" durante el build (Cloudflare ya sirve `index.html`
  para cualquier ruta sin archivo estático automáticamente) — probado
  contra el despliegue real y retirado del repo.

- Favicon e identidad de pestaña propios: se quedó sin tocar el
  `<title>Vite App</title>` y el favicon genérico de Vue del scaffold
  inicial durante varios bloques de trabajo. Ahora el favicon reutiliza
  el mismo icono que la marca en `AppHeader.vue`, y `<html lang>` se
  mantiene sincronizado con el idioma activo en vez de quedarse fijo.

- Texto de la pantalla de onboarding menos programático: "Crear un
  bebé" sonaba a acción de un CRUD, no a algo que le diría la app a un
  padre o madre reales. Ahora "Empieza con tu bebé" / "Empezar", y "O
  unirme a un bebé existente" pasa a "O unirme con un código de
  invitación" (mismo cambio en inglés). Encontrado probando la app ya
  desplegada, no en desarrollo.

- El formulario de "+ Medida" pedía el peso en gramos como número
  entero (`min="1"`, sin `step`), lo que en la práctica obligaba a
  reescribir la cifra entera cada vez en vez de ajustarla poco a poco.
  Ahora pide el peso en kg con `step="0.1"` (mismo patrón que talla y
  perímetro craneal), y la línea temporal de crecimiento también
  muestra el peso en kg en vez de gramos. El contrato con la API no
  cambia: sigue enviando/guardando `weight_grams` como entero, la
  conversión kg↔gramos se hace solo en el frontend.

- El botón "Sexo / fecha de nacimiento" de la tarjeta del bebé se
  quedaba igual una vez guardados esos datos, sin ningún indicio visual
  de qué había configurado. Ahora el propio botón muestra el valor
  guardado (p. ej. "Niña · 7/9/2026") en vez del texto genérico, y
  sigue abriendo el mismo ajuste al pulsarlo.

- El icono propio de la marca (trazo lineal en la cabecera y el
  favicon) resultó ambiguo: a tamaño de pestaña no se distinguía qué
  representaba. Sustituido directamente por el emoji 👶, tanto en
  `AppHeader.vue` como en `favicon.svg` — se lee con claridad a
  cualquier tamaño sin necesitar un `favicon-64.png` de *fallback*
  (retirado).

- La app cambia de acento de color según el sexo del bebé: azul + verde
  salvia para "niño", rosa/berenjena + malva para "niña" (con su propia
  variante en modo oscuro), sin tocar el resto de la paleta ni los
  colores por categoría de registro. El cambio se ve al momento al
  tocar el selector de sexo, sin esperar a pulsar "Guardar". Sin sexo
  elegido (o, en broma, por si hay gemelos de ambos sexos) usa "combo",
  una mezcla de ambos temas: acento morado/malva en general y un
  degradado azul→rosa explícito en la tarjeta del bebé. Se aplica vía
  `data-sex` en `<html>`, controlado desde `DashboardView.vue`.

- Sistema de notificaciones toast, mismo patrón que LudoDex y MIRA
  MarketLens (`stores/toast.ts` + `ToastNotification.vue`, un único
  mensaje sin cola, montado una vez en `App.vue`): confirma acciones
  que hasta ahora eran silenciosas y sin ningún indicio de si habían
  funcionado — borrar una toma/sueño/pañal/medida/hito, guardar sexo/
  fecha de nacimiento, regenerar el código de invitación, y crear o
  unirse a un bebé. Los registros rápidos (toma/sueño/pañal/medida/
  hito) no llevan toast: la hoja se cierra y la entrada aparece al
  momento en su lista, que ya es suficiente confirmación ahí.

- El toast de borrado decía simplemente "Eliminado.", sin decir qué se
  había borrado. Ahora es específico por tipo ("Toma eliminada.",
  "Sueño eliminado.", "Pañal eliminado.", "Medida eliminada.", "Hito
  eliminado.", con su error a juego), en vez de una única clave
  genérica.

- Nada de lo que se registra (toma, sueño, pañal, medida o hito) puede
  llevar ahora una fecha anterior al nacimiento del bebé. En el
  frontend, cada campo de fecha lleva un `min` calculado a partir de
  `birth_date` (el propio navegador bloquea el envío e incluso muestra
  su aviso nativo), y en la API, `StoreXRequest`/`UpdateXRequest`
  añaden una regla `after_or_equal` contra esa misma fecha a través de
  un trait compartido (`ValidatesNotBeforeBirth`) — defensa en
  profundidad, no solo cosmética del formulario. Sin `birth_date`
  todavía (ninguno de los dos, opcionales) no hay restricción: no hay
  nada contra lo que comparar. El día exacto del nacimiento sí es
  válido (`after_or_equal`, no `after`) — un hito de "Nacimiento" ese
  mismo día tiene que poder registrarse.

- Hitos como mini-diario, no como fila de lista: la foto se mostraba a
  40×40px sin ninguna forma de verla más grande — tocarla no hacía
  nada. `MilestoneCard.vue` la muestra ahora a tamaño real de tarjeta
  (formato 4:3, dos columnas en cuadrícula tipo álbum; sin foto, un
  icono de estrella ocupa su sitio en vez de dejarlo vacío), y tocar la
  tarjeta abre una hoja de detalle con la foto a tamaño completo,
  título, fecha y la descripción entera (antes recortada a dos líneas
  en la lista). `BottomSheet.vue` gana `max-h-[85vh]` y scroll propio,
  necesario ahora que una foto grande puede superar la altura de la
  pantalla.

- Menú de usuario básico, mismo patrón que LudoDex y MIRA MarketLens:
  el nombre en la cabecera del dashboard ahora abre una hoja de "Tu
  cuenta" con nombre/email, cambio de contraseña, y foto de perfil.
  La foto sigue el enfoque de MIRA MarketLens, no el de los hitos
  (Cloudflare R2): se guarda como un `data:` URI en una columna
  `avatar` de `users`, no como archivo en disco — de sobra para una
  foto pequeña, y evita depender de nada externo solo para esto.
  `AvatarProcessor` (GD, igual que el favicon del propio proyecto) la
  redimensiona a 320×320 como máximo antes de guardarla. Sin errores
  por campo como en LudoDex/MIRA — un toast genérico por acción, igual
  que el resto de esta app.

- El código de invitación se veía siempre en la tarjeta del bebé,
  aunque solo hace falta una vez (al vincular al otro cuidador) y esa
  tarjeta se ve en cada visita al dashboard. Ahora empieza colapsado
  (sin recordar el estado entre visitas) y se despliega al tocar el
  nombre del bebé, con una flecha que indica que se puede abrir. El
  botón de sexo/fecha de nacimiento, al lado, sigue siendo su propio
  control independiente — tocarlo no colapsa ni expande nada.

- CI en rojo por formato (`npx prettier --check src/`, paso "Format
  check (Prettier)" del job de frontend): dos archivos no cumplían el
  estilo. La verificación local de cada bloque de trabajo solo pasaba
  `vue-tsc`, ESLint, Vitest y el build — nunca Prettier en modo
  comprobación, así que se coló hasta que el CI lo pilló. Arreglado
  con `npx prettier --write` (cambio puramente cosmético, sin tocar
  lógica) y confirmado en verde en GitHub Actions.

- Corregido en producción: subir un hito con foto desde el móvil se
  quedaba "pensando" sin ningún error, mientras que sin foto sí
  funcionaba. Causa real: la imagen de Docker no llevaba ningún
  `php.ini` propio, así que PHP caía en sus valores por defecto
  (`upload_max_filesize=2M`, `post_max_size=8M`) — por debajo de lo
  que la propia app ya valida (`UpdateMilestoneRequest` acepta fotos
  de hasta 8MB). Una foto real de móvil supera esos 2MB sin esfuerzo,
  así que PHP descartaba la petición entera en silencio antes de que
  Laravel llegara a verla. Nunca se detectó en local porque el
  `php.ini` de XAMPP ya permite 40MB. Arreglado con `docker/uploads.ini`
  (`upload_max_filesize=10M`, `post_max_size=12M`), copiado a
  `/usr/local/etc/php/conf.d/` en el Dockerfile. De paso, los cinco
  formularios de registro rápido (toma/sueño/pañal/hito) no tenían
  ningún manejo de errores — un fallo (de red, de validación, de lo
  que sea) no mostraba nada al usuario. Ahora avisan con un toast
  genérico, igual que el resto de la app.

- Pequeña auditoría de seguridad y rendimiento tras lo anterior:
  `POST /api/babies/join` no tenía `throttle`, a diferencia de
  login/password/avatar — añadido (`throttle:10,1`), aunque el espacio
  de códigos (32⁸) ya hacía el brute-force poco práctico.
  `AvatarProcessor` decodificaba la imagen entera en memoria
  (`imagecreatefromstring`) antes de comprobar sus dimensiones — una
  imagen pequeña en bytes pero con dimensiones absurdas podía agotar
  la memoria de ese worker; ahora se leen las dimensiones con
  `getimagesize()` (solo la cabecera) y se rechaza antes de decodificar
  nada. `BabyPolicy` cargaba la relación `users` entera en memoria solo
  para comprobar pertenencia (`$baby->users->contains($user)`) — ahora
  es una consulta (`whereKey($user->id)->exists()`). `TimelineController`
  traía el historial completo de tomas/sueño/pañales en cada llamada
  antes de aplicar el `limit` — como el dashboard sondea este endpoint
  cada 5 segundos mientras está abierto, el coste crecía con el
  histórico completo del bebé en vez de con lo que se muestra; ahora
  cada subconsulta se limita por su cuenta antes de fusionar. Y
  `BabyController::update` (el endpoint tras "Sexo / fecha de
  nacimiento") no tenía ningún test — añadidos tres, igual que ya
  tenía el resto de endpoints de `Baby`.

- Al abrir cualquier hoja inferior, un dedo (o una rueda de ratón) que
  arrancaba sobre el fondo oscuro seguía moviendo el dashboard por
  debajo — mismo fallo que ya se corrigió en LudoDex
  (`GameDetailModal`), y el mismo arreglo: bloquear el scroll del
  `body` mientras haya una hoja abierta, más `overscroll-behavior:
  contain` en el propio panel para que el scroll dentro de la hoja no
  "encadene" hacia la página al llegar a su límite. La diferencia con
  LudoDex es que aquí `DashboardView.vue` tiene varias hojas montadas
  a la vez (una por cada registro rápido, más ajustes y el detalle de
  hito) — un simple guardar/restaurar por instancia de `BottomSheet`
  se pisaría entre sí si dos llegaran a coincidir, así que el bloqueo
  vive en un módulo aparte (`src/lib/bodyScrollLock.ts`) con contador
  de referencias, no en el propio componente.

- Unirse a un bebé con código de invitación no cargaba su historial
  (tomas/sueño/pañales/crecimiento/hitos) hasta recargar la página a
  mano — parecía que el otro cuidador no tenía nada registrado.
  `onMounted` solo pide ese historial una vez, al montar el
  componente; que `babies.current` pasara de vacío a tener datos
  *después* (justo lo que hace unirse a un bebé que, a diferencia de
  crear uno nuevo, ya tiene historial real) no volvía a dispararlo.
  Extraída esa carga a `loadBabyData()`, reutilizada tanto en el
  montaje inicial como justo después de crear o unirse. De paso,
  ahora se ve el "Cargando…" que ya existía para el montaje inicial
  también en este momento, en vez de que la pantalla se quede en
  blanco mientras se pide todo — verificado con dos cuentas de prueba
  reales (una crea el bebé y registra una toma y un hito, la otra se
  une con el código y los ve aparecer sin recargar).

- Ahora se puede editar un hito ya creado (fecha, título, descripción
  y foto — sustituirla o quitarla), no solo verlo y borrarlo. El
  backend ya tenía `MilestoneController::update` construido y probado
  desde el principio; lo único que faltaba era que el frontend lo
  llamara. El botón "Editar" en la hoja de detalle reutiliza el mismo
  formulario de "+ Hito", precargado con los datos actuales
  (`openMilestoneEdit()`); con foto ya puesta, se ve su miniatura con
  un enlace de "Quitar foto" antes del selector de archivo. El resto
  de registros (toma/sueño/pañal/medida) se queda sin editar por
  ahora — solo se pidió esto para hitos.

- Hitos reimaginados como un diario interactivo, no un formulario y una
  cuadrícula genéricos: el detalle de un hito era el mismo `BottomSheet`
  que cualquier otro registro, y así se sentía como una fila de lista
  más en vez de un recuerdo. Cuatro cambios juntos, pensados como una
  sola revisión de la funcionalidad:
  - **Categoría**: `Milestone` gana un campo `category` opcional (enum
    `App\Enums\MilestoneCategory`: sonrisa/diente/pasos/palabra/otro,
    nullable — "otro" es una elección real, no el valor por defecto de
    "nadie eligió nada"). El formulario de "+ Hito" la pide primero,
    como chips con su propio emoji (no `SegmentedControl.vue`: sus
    columnas iguales no dejan sitio a 5 etiquetas en español en un móvil
    de 360px), y elegir una sugiere un título y cambia el *placeholder*
    de la descripción a una pregunta concreta ("¿Cuándo y dónde fue?
    ¿Cómo os sentisteis?" para sonrisa, etc.) — sin bloquear el título
    si se prefiere escribir otra cosa. `MilestoneCard.vue` muestra el
    emoji como insignia sobre la miniatura, y lo reutiliza como icono de
    "sin foto" en vez de la estrella genérica de antes.
  - **Reacciones**: cualquier cuidador vinculado puede dar o quitar un
    "me encanta" a un hito (`POST /babies/{baby}/milestones/{milestone}/like`,
    un único toggle, no rutas separadas de like/unlike) — tabla pivote
    pura `milestone_likes`, mismo patrón sin `id` que `baby_user`. Se
    autoriza con `authorize('view', $baby)`, no `'update'`: reaccionar
    es una interacción ligera que cualquiera con acceso al bebé debería
    poder hacer, no una edición del hito.
  - **Visor a pantalla completa estilo "stories"**: sustituye la hoja de
    detalle. Foto a tamaño completo sin recortar (`object-contain`, no
    `object-cover` — aquí sí importa no perder parte de la foto), o un
    degradado del color de "hito" con el emoji de su categoría en
    grande cuando no hay foto. Navegación entre hitos por gesto de
    deslizar (`touchstart`/`touchend`, sin librería), flechas visibles,
    y teclado (flechas y Escape) — se guarda el id del hito que se está
    viendo, no el objeto, para que sobreviva a un refetch de la lista
    (tras dar un "me encanta", por ejemplo) y se cierre solo si el hito
    deja de existir (borrado desde el otro cuidador). Reutiliza el
    bloqueo de scroll de `bodyScrollLock.ts`.
  - Verificado de punta a punta con dos cuentas de prueba reales sobre
    la API real (no solo en tests): crear un hito con categoría desde
    el formulario guiado, verlo en el visor, navegar entre varios,
    reaccionar desde una cuenta y verlo reflejado en la otra, editar y
    borrar desde dentro del propio visor.

- `ThemeToggle.vue` mostraba el icono del estado actual (luna en modo
  oscuro, sol en modo claro) en vez del estado al que se cambia al
  pulsar, al revés que el resto de esta suite de apps. Invertida la
  condición para que coincida con LudoDex/MIRA MarketLens: en oscuro se
  ve el sol, en claro la luna.

- Selector de idioma fuera de la cabecera: no hace falta un acceso
  rápido para algo que un cuidador configura una vez y no vuelve a
  tocar mientras usa la app, y quitarlo deja sitio en el nav para su
  rediseño. `LanguageSwitcher.vue` (el toggle ES/EN de `AppHeader.vue`,
  visible en todas las pantallas) desaparece; cambiar de idioma pasa a
  ser un control segmentado más dentro de "Tu cuenta", junto a nombre/
  email. Sin selector en login/registro (ahí no hay cuenta todavía
  donde guardar la preferencia): `getStoredLocale()` deja de forzar
  español por defecto y cae al idioma del navegador
  (`navigator.language`) cuando no hay nada guardado — mismo patrón que
  MIRA MarketLens —, y solo respeta lo guardado si el usuario ya lo
  cambió alguna vez desde "Tu cuenta". Verificado en el navegador con
  una cuenta de prueba real: login/registro sin selector, cambio de
  idioma desde "Tu cuenta" reflejado al instante en toda la interfaz.

- El espacio que dejó libre ese selector en la cabecera se usa ahora
  para la propia cuenta: la fila de avatar + nombre + "Cerrar sesión"
  que vivía debajo de la cabecera (solo visible una vez creado o unido
  a un bebé) sube a `AppHeader.vue`, con "Cerrar sesión" como icono en
  vez de texto. El wordmark "👶 PequeDex" se queda siempre a la
  izquierda (login/registro/onboarding incluidos); a la derecha, en
  cuanto hay cuenta y bebé, el orden es tema → avatar (sin el nombre al
  lado, solo la foto — abre "Tu cuenta" igual que antes) → cerrar
  sesión. Como `AppHeader.vue` es global (vive en `App.vue`, no dentro
  de `DashboardView.vue`) y no puede llamar directamente a la función
  que abre la hoja de "Tu cuenta", ese único flag cruza el límite entre
  componentes vía un store nuevo y mínimo (`stores/ui.ts`, un booleano
  y dos acciones) en vez de duplicar la hoja o inventar una ruta
  aparte. Verificado en el
  navegador con una cuenta de prueba real: abrir "Tu cuenta" desde la
  cabecera, guardar, cerrar, y cerrar sesión con el icono nuevo.

- Ahora se puede editar una toma, un sueño o un pañal ya registrado
  tocando su fila en la línea temporal, no solo verlo y borrarlo —
  mismo patrón que ya tenía el hito. `EntryCard.vue` envuelve su
  contenido principal en un botón propio (`@open`) en vez de que toda
  la fila sea clicable, para que el icono de borrar siga siendo un
  control independiente sin necesitar `stopPropagation`. El backend ya
  tenía los tres endpoints `update` construidos y probados desde el
  principio (igual que pasó con los hitos); solo faltaba que el
  frontend los llamara.

- De paso, un fallo real de zonas horarias al implementar lo anterior:
  guardar una edición sin tocar la hora la desplazaba igualmente, en
  este entorno +2h — reproducido en el navegador (una toma a las
  20:30 pasaba a las 22:30 con solo cambiar la cantidad). Causa: el
  backend tiene `app.timezone = UTC`, pero el valor de un
  `<input type="datetime-local">` no lleva zona horaria propia — se
  mandaba tal cual, y el servidor lo interpretaba como si ya fuera UTC
  en vez de hora local. Al crear un registro nuevo pasaba lo mismo (la
  hora guardada no era la real), solo que nadie lo notaba porque no
  había nada con lo que compararla todavía; edición además desplazaba
  la hora en cada guardado sucesivo. Arreglado convirtiendo con
  `new Date(valorLocal).toISOString()` antes de enviar cualquier
  `started_at`/`ended_at`/`changed_at` de toma, sueño o pañal — los
  campos de solo fecha (medida, hito) no llevan este problema, al no
  tener componente de hora que malinterpretar. Verificado en el
  navegador comparando el valor guardado en la API antes y después del
  arreglo con la misma edición.

- Las medidas de crecimiento también se pueden editar ahora tocando su
  fila, mismo patrón que el resto de registros: `openGrowthEdit()`
  precarga el formulario de "+ Medida" y `updateGrowthMeasurement()`
  reutiliza el mismo payload que crearla. El backend ya tenía el
  endpoint `update` construido y probado; solo faltaba conectarlo.
  Verificado en el navegador con una cuenta de prueba real, incluido
  que el percentil se recalcula tras el cambio.

- Rediseño del dashboard ("Ritmo Diario"), a partir de una maqueta
  propuesta y aprobada antes de tocar código real (mismo proceso que la
  identidad visual original): la app se sentía como una hoja de
  registros, no como un diario. Tres piezas nuevas:
  - **Portada "Hoy con {nombre}"**: la tarjeta del bebé ya no muestra
    solo su nombre — ahora es un titular con la edad en días (menos de
    dos semanas) o semanas, la fecha de nacimiento, y un chip con el
    sexo. Si el bebé aún no ha nacido pero hay `due_date`, muestra la
    cuenta atrás en su lugar; sin ninguna fecha, se queda en un saludo
    genérico. El cálculo vive en `src/lib/babyAge.ts` (con tests
    propios): las fechas son de solo-día ("YYYY-MM-DD"), así que se
    parsean como fecha de calendario local en vez de con `new
    Date(iso)`, que las trata como medianoche UTC y puede desplazar el
    día según la zona horaria del navegador. El resto de la
    funcionalidad de la tarjeta (desplegar el código de invitación,
    abrir el ajuste de sexo/fecha) sigue igual, solo cambia lo que se
    ve antes de tocarla.
  - **Hitos como historias**: `MilestoneStories.vue` sustituye la
    cuadrícula de hitos por una fila de círculos con anillo degradado
    (foto o emoji de categoría dentro), estilo Instagram Stories, con
    un círculo "+" al final para crear uno nuevo — el visor a pantalla
    completa que ya existía sube arriba del todo en vez de vivir
    enterrado tras la línea temporal y el crecimiento.
    `MilestoneCard.vue` (la cuadrícula que sustituye) se elimina por
    completo, no queda código muerto.
  - **Ritmo de hoy**: `DailyRhythm.vue`, una franja de 00 a 24h con los
    tramos de sueño y las marcas de toma/pañal de *hoy* (no las últimas
    24h en bruto, el día de calendario), calculada a partir de la
    misma `babies.timeline` que ya se pedía — sin llamadas nuevas a la
    API. Una siesta en curso se recorta a "ahora", no se extiende hacia
    el resto del día que todavía no ha pasado.
  - Además: `EntryCard.vue` cambia el borde de color fino por un
    lavado de fondo del color de la categoría (con el icono sobre un
    chip translúcido para que no se pierda contraste), y
    `ActionBar.vue` pasa de barra plana pegada al borde a una pastilla
    flotante con sombra y margen — ambos cambios pedidos junto con el
    resto de la maqueta. Verificado en el navegador con una cuenta de
    prueba real en claro y oscuro: portada con edad calculada, tira de
    hitos abriendo el visor y el formulario de creación, ritmo del día
    con datos reales, y edición de una toma sigue funcionando desde la
    fila rediseñada.

- La portada "Hoy con {nombre}" repetía el sexo y la fecha de
  nacimiento dos veces: una vez en el propio cuerpo de la tarjeta
  (chip + fecha) y otra vez, idéntica, como etiqueta del botón de
  ajustes ("Niña · 1/7/2026" en ambos sitios) — y ese botón, con solo
  texto, dejaba la esquina superior derecha de la tarjeta casi vacía.
  Ahora fecha y sexo se combinan en un único chip
  ("Nació el 1/7/2026 · 🌸 Niña"), y el botón de ajustes pasa a ser
  solo un icono de lápiz (la información que repetía ya no hace falta
  restatarla). Una marca de agua 👶 traslúcida ocupa el hueco inferior
  derecho que quedaba vacío. Verificado en el navegador en claro y
  oscuro con una cuenta de prueba real: el icono sigue abriendo el
  mismo ajuste de sexo/fecha de siempre.

- Reordenada la portada "Hoy con {nombre}" una vez más: el chip de
  sexo (con su emoji, "🌸 Niña"/"💙 Niño") sube a la esquina superior
  derecha junto al icono de ajustes, y "Nació el {fecha}" pasa a la
  misma altura que la edad en vez de ir debajo — ambos con la misma
  línea base (`items-baseline`), como pediría alguien leyendo la
  tarjeta de un vistazo. Se retira la marca de agua 👶 genérica: con
  el chip de sexo ya arriba, un segundo emoji de bebé abajo competía
  por la misma esquina sin aportar nada que el chip no dijera ya.

- Dos últimos ajustes de posición en la misma tarjeta: el icono de
  ajustes pasa a la izquierda del chip de sexo (antes iba a la
  derecha), y "Nació el {fecha}" se empuja al extremo derecho de su
  línea (`justify-between` en vez de ir pegado al número de la edad),
  quedando alineado bajo el chip de sexo en vez de justo al lado de
  "8 semanas".

- Ese `justify-between` no llegaba en realidad al borde derecho de la
  tarjeta: la fecha vivía dentro del mismo botón (ancho `flex-1`) que
  compartía fila con el icono de ajustes y el chip de sexo, así que
  solo podía estirarse hasta donde empezaba esa columna, no hasta el
  borde real de la tarjeta. El icono de ajustes y el chip de sexo
  pasan a un bloque posicionado en la esquina (`absolute top-5
  right-5`), fuera del flujo del botón; éste pasa a ocupar el ancho
  completo de la tarjeta, y "Nació el {fecha}" llega ahora sí hasta el
  borde derecho real, alineado con el chip de sexo de encima.
  Verificado en el navegador (cuenta real, con permiso explícito para
  usarla en pruebas locales): el desplegable del código de invitación
  y el icono de ajustes siguen funcionando igual.

- "Nació el {fecha}" pasa de formato numérico ("31/8/2026") a formato
  largo ("Nació el 31 de agosto de 2026"), vía las opciones
  `{ day: 'numeric', month: 'long', year: 'numeric' }` de
  `toLocaleDateString()` en vez de la llamada sin opciones — `Intl`
  añade los conectores "de...de" en español automáticamente, sin
  tener que escribirlos a mano (y en inglés da "31 August 2026", sin
  conectores, también correcto). Mismo formato para "Fecha prevista:
  {fecha}" en el caso de cuenta atrás. Verificado en el navegador con
  la cuenta real.

- Un usuario recién registrado que todavía no ha creado ni se ha unido
  a un bebé no tenía ninguna forma de cerrar sesión ni de entrar en
  "Tu cuenta" — ambos botones de `AppHeader.vue` exigían
  `auth.user && babies.current`, y la propia hoja de "Tu cuenta" vivía
  dentro de la rama de `DashboardView.vue` que solo se monta cuando ya
  existe un bebé. Efecto colateral encontrado durante el rediseño de
  la cabecera, dejado fuera de alcance a propósito en su momento.
  Arreglado: la hoja sube a un nivel donde está disponible
  independientemente del estado del onboarding, y ambos botones pasan
  a depender solo de `auth.user`.

- Nueva tarjeta "Sueño esta semana" bajo el "Ritmo de hoy": una barra
  por cada uno de los últimos 7 días de calendario con las horas de
  sueño totales de ese día, para ver el patrón de la semana de un
  vistazo en vez de solo el día suelto. `src/lib/sleepHistory.ts`
  (con tests propios) reparte cada sueño entre los días que
  realmente ocupa — uno que cruza la medianoche se cuenta en ambos
  días proporcionalmente, no entero en el día en que empezó — y
  recorta un sueño en curso a "ahora" en vez de extenderlo hacia el
  resto del día. `SleepController::index` admite ahora un parámetro
  `since` (con tests propios) para pedir solo una ventana reciente en
  vez de todo el historial del bebé en cada carga del dashboard — el
  propio endpoint nunca tenía límite alguno hasta ahora, a diferencia
  de `TimelineController`. Verificado en el navegador con la cuenta
  real (bebé recién nacido: la barra de hoy con horas reales, el
  resto de la semana en cero, tal y como corresponde).

- El emoji 👶 de la cabecera y el favicon (puesto como solución rápida
  tras descartar el primer icono propio por ambiguo, ver más arriba)
  deja paso a una marca propia definitiva: una huella de bebé con un
  corazón marcado en la planta, en el degradado de marca ya existente
  (`--brand` → `--brand-teal`), así que se retiñe sola con el sexo del
  bebé y el tema claro/oscuro sin ningún color nuevo que mantener.
  `AppMark.vue` expone dos pesos de la misma forma: completa (con los
  cinco dedos) para la cabecera y la pantalla de carga, y una reducida
  (sin dedos) pensada para el favicon a 16-32px — comprobado a ese
  tamaño real que los dedos se emborronan en una mancha, así que el
  favicon se queda en la versión reducida aunque la cabecera, a 24px,
  sí los admite con nitidez suficiente. La pantalla de "Cargando…" del
  dashboard anima el mark (el corazón late con su propio ritmo, la
  huella hace un ligero rebote de paso) en vez de mostrar solo texto,
  con `prefers-reduced-motion` respetado. Propuesto primero como
  maqueta visual con tres direcciones distintas y aprobado antes de
  tocar código real, mismo proceso que la identidad visual original y
  el rediseño del dashboard. Verificado en el navegador en claro y
  oscuro, y en el momento real de carga del dashboard con una cuenta de
  prueba real.

- Restablecimiento de contraseña, hasta ahora inexistente (un usuario que
  la olvidaba no tenía ninguna forma de recuperar la cuenta). Mismo
  patrón ya en marcha en LudoDex y MIRA_MarketLens: `POST /forgot-password`
  responde siempre con el mismo mensaje exista o no ese email — hallazgo
  de una auditoría de seguridad en MIRA_MarketLens, replicado aquí desde
  el principio en vez de repetir el fallo — y `POST /reset-password`
  reutiliza el broker de contraseñas de Laravel. `ResetPasswordNotification`
  (con `lang/{es,en}/mail.php`) reemplaza el correo genérico "Laravel" por
  uno traducido y de marca "PequeDex" — mismo enfoque con clase propia que
  LudoDex, no el `toMailUsing()` sin traducir de MIRA_MarketLens — aunque
  PequeDex, a diferencia de esos dos, no tiene todavía ningún middleware
  que cambie el idioma según cabecera, así que hoy corre siempre en
  `APP_LOCALE` (español); la traducción queda lista para cuando exista.
  El enlace del correo apunta a la SPA (`FRONTEND_URL`, nueva
  `config('app.frontend_url')`), no a una ruta web inexistente en esta
  API. Remitente Resend `onboarding@resend.dev` (sandbox, sin dominio
  propio verificado todavía — decisión explícita para salir cuanto antes,
  no un descuido). Sin logo en el correo por ahora (a diferencia de
  LudoDex): no había forma de convertir el `favicon.svg` del proyecto a
  PNG en este entorno; puede añadirse después como mejora aparte, igual
  que en LudoDex. Pantallas nuevas (`ForgotPasswordView.vue`,
  `ResetPasswordView.vue`) con el mismo estilo Tailwind ya establecido en
  login/registro, y un enlace "¿Has olvidado tu contraseña?" en el login.
  9 tests Pest nuevos.

- Abandonar un bebé (`DELETE /babies/{baby}/leave`): hasta ahora, una vez
  vinculado con un código de invitación, no había forma de deshacerlo salvo
  tocando la base de datos a mano — hallazgo de la propia auditoría de código
  que encontró el resto de fallos de esta tanda. Bloqueado como único
  cuidador restante (dejaría el bebé sin nadie que pueda acceder a él, para
  siempre, mismo motivo por el que `store()` ahora va en transacción); con
  otro cuidador vinculado, funciona sin restricciones. Confirmación en dos
  pasos en el propio ajuste de "Sexo / fecha de nacimiento" (reutilizado en
  vez de crear un sitio nuevo), con el mismo criterio de "un mensaje fijo
  basta" que el resto de esta app — la única razón real de fallo (ser el
  único cuidador) ya la cubre ese mensaje. Verificado de punta a punta en el
  navegador con dos cuentas de prueba reales: bloqueado en solitario,
  permitido con un segundo cuidador vinculado, vuelta automática a la
  pantalla de onboarding tras abandonar.

### Cambiado

- **Frontend migrado de Cloudflare Pages a GitHub Pages** — el dominio
  `pequedex.pages.dev` quedó asignado a un rango de IP de Cloudflare
  (`188.114.96.0/97.0`) inalcanzable desde varias redes distintas
  (confirmado con dos ISPs independientes, wifi y datos móviles, mientras
  `ludodex.pages.dev`/`mira-marketlens.pages.dev` — en otro rango,
  `172.66.x.x` — seguían funcionando bien), sin que Cloudflare lo
  resolviera en el rato que se esperó. Nueva URL:
  [odeirz.github.io/PequeDex](https://odeirz.github.io/PequeDex/).
  `web/vite.config.ts` fija `base: '/PequeDex/'` (GitHub Pages sirve un
  project page bajo esa ruta, no en la raíz del dominio, a diferencia de
  Cloudflare Pages) — el favicon en `index.html` pasa a `%BASE_URL%favicon.svg`
  para no quedar roto. `public/404.html` + un script en `index.html`
  restauran la ruta real tras un refresh en cualquier URL que no sea la
  raíz (técnica `spa-github-pages` estándar): GitHub Pages no tiene
  rewrite de servidor para el modo `history` de vue-router, así que sin
  esto cualquier ruta que no fuera `/` devolvía un 404 real en vez de la
  SPA. `.github/workflows/ci.yml` gana un job `deploy-pages`
  (`actions/upload-pages-artifact` + `actions/deploy-pages`, con los
  permisos `pages: write`/`id-token: write` que exige) junto al ya
  existente `deploy` (que sigue disparando el deploy de la API en
  Render) — ambos corren solo en push a `main`.

### Corregido

- La app está pensada mayoritariamente para uso en móvil, pero varias
  micro-animaciones y la única forma de ver la hora exacta de una marca
  en "Ritmo de hoy" dependían de `:hover` - inexistente al tocar en vez
  de pasar el ratón. La hora de cada marca (toma/sueño/pañal) vivía solo
  en un atributo `title`, un tooltip nativo que solo aparece con ratón:
  en móvil esa información era directamente inalcanzable. Las marcas
  pasan de `<span>` a `<button>` y tocarlas abre esa misma hora en una
  burbuja propia (se cierra al tocar la misma marca, otra, o fuera de la
  barra; también al cambiar de día, para no dejarla apuntando al día
  equivocado). Aparte, varios botones reales (flechas de día, volver y
  exportar de "Contracciones", el botón de gota de agua, la fila de
  edición de una contracción) solo tenían `hover:` y ninguna respuesta
  visual al tocar - ganan su `active:`/`group-active:` equivalente.
- "Añadir otro bebé" pasa a "Añadir bebé" — la hoja detrás del botón no
  solo crea uno nuevo, también deja unirse a uno existente vía código
  de invitación, y "otro" daba a entender que solo servía para crear.
  "Abandonar este bebé" pasa a "Dejar de cuidar al bebé" — lo que la
  acción hace de verdad es dejar de ser cuidador, no "abandonar" al
  bebé, coherente con el propio texto de confirmación que ya lo decía
  así ("dejar de ser cuidador"); se actualizan también el botón de
  confirmar, el estado de carga y el mensaje de error para no dejar
  "abandonar" a medias en el resto del flujo. Auditoría completa de
  `es.ts` contra `en.ts` tras el cambio (273 claves en cada fichero,
  estructura idéntica): una sola discrepancia real de significado,
  `leaveConfirmYes` en inglés seguía con el "Yes, leave" antiguo en vez
  de reflejar el nuevo matiz español — corregido a "Yes, stop caring
  for the baby".
- Las tarjetas de predicción (reubicadas arriba con el aspecto de un
  evento registrado, ver más arriba) heredaban también la elevación al
  hover, el icono que escala y el `<button>` de `EntryCard` — pero no
  hay nada detrás que abrir, así que invitaban a un toque que no hacía
  nada. Nuevo prop `interactive` en `EntryCard.vue` (`false` para estas
  dos): mismo layout, sin la promesa visual de que algo va a pasar al
  tocarlo.
- Los errores de validación al registrar toma/sueño/pañal/medida/hito
  (p. ej. la hora de fin anterior a la de inicio) mostraban siempre el
  mismo toast fijo — "No se ha podido guardar. Comprueba tu conexión e
  inténtalo de nuevo." — indistinguible de una caída de red real,
  aunque el backend sí devolvía un mensaje concreto por campo. Ese
  mensaje, a su vez, era una traducción literal de Laravel sin
  atributos personalizados ("El campo ended at debe ser una fecha
  posterior a fecha"), así que tampoco decía nada útil. Ahora el
  backend devuelve una frase real por regla en cada `Store`/`Update`
  Request ("La hora de fin debe ser posterior a la hora de inicio.")
  y el frontend la muestra en vez de descartarla — el toast genérico
  de conexión queda solo para cuando de verdad lo es (sin respuesta,
  500, etc.).
- Las marcas de toma/pañal de "Ritmo de hoy" quedaban desplazadas unos
  píxeles a la derecha de su hora real: cada marca es una barra de 5px
  cuyo `left: X%` posicionaba el borde izquierdo en el instante exacto,
  no el centro — más notorio cuanto más estrecha la gráfica. Centrada
  con `-translate-x-1/2`; los segmentos de sueño no se tocan, ya que su
  ancho representa la duración real y su borde izquierdo sí es el
  punto correcto. La propia escala horaria bajo la gráfica
  ("0h/6h/12h/18h/24h") seguía sin coincidir con las marcas ya
  corregidas: usaba `flex justify-between` sobre texto de ancho
  desigual, que reparte espacio por hueco entre cajas de texto, no por
  posición porcentual real, así que "6h"/"12h"/"18h" quedaban varios
  puntos porcentuales fuera de su 25%/50%/75% real. Pasan a
  posicionarse por el mismo porcentaje absoluto que las marcas (0h/24h
  ancladas a los bordes, el resto centradas).
- Al navegar a un día pasado, "Línea temporal" seguía mostrando
  también entradas de la madrugada del día siguiente — reproducido en
  producción, no solo en local. El backend calcula el rango de ese día
  (deliberadamente algo más ancho, para no cortar un sueño que cruza
  medianoche) en límites UTC, no en la zona horaria del navegador; con
  una zona por delante de UTC (Europe/Madrid) eso se traduce a un
  tramo local que se pasa de la medianoche. "Ritmo de hoy" ya recortaba
  esto por su cuenta para las barras; "Línea temporal" renderizaba la
  respuesta del backend sin ese recorte. Ahora filtra también a los
  límites locales exactos del día antes de agrupar.
- El icono de gota de la tarjeta "Contador de contracciones" en el
  dashboard sugería "agua" en vez de "cronómetro/contador" — se
  reutiliza dentro de la propia pantalla de contracciones para la
  rotura de bolsa de aguas específicamente. Sustituido por un icono de
  cronómetro, representativo de la función real.
- El PDF exportado listaba las contracciones de más antigua a más
  reciente, al revés que `ContractionTimeline.vue` en la app (donde la
  más reciente aparece arriba con el número más alto). Se invierte el
  orden y la numeración para que coincida con lo que se ve en pantalla.
  De paso, mejoras de legibilidad para el papel impreso: la escala
  tipográfica completa (título, cabeceras, filas, intervalos) sube de
  tamaño, pensada originalmente para pantalla; el separador de día
  queda centrado en su barra en vez de a la izquierda; las columnas se
  reequilibran (duración, que solo contiene "mm:ss", se estrecha en
  favor de inicio/fin/intensidad); y todo el contenido de la tabla pasa
  a alinearse a la derecha.
- En pantallas estrechas, "Duración promedio" e "Intervalo promedio"
  envuelven a dos líneas mientras "Veces por hora" se queda en una, así
  que el valor de cada columna del bloque de estadísticas de
  contracciones arrancaba a una altura distinta según cuántas líneas
  ocupara su etiqueta. Cada etiqueta reserva ahora una altura mínima
  fija, para que los tres valores queden siempre alineados en la misma
  fila.
- Antes de que naciera el bebé (sin `birth_date`, o con una
  `birth_date` puesta de antemano que todavía no ha llegado), el
  dashboard seguía mostrando estadísticas de hoy, ritmo, sueño de la
  semana, línea temporal, predicciones, crecimiento, hitos y la barra
  de accesos rápidos — no tiene sentido, no hay nada que trackear de
  un bebé que aún no existe. Solo la tarjeta de "Contador de
  contracciones" tenía en cuenta ese estado. `getBabyAge()` también
  clasificaba una `birth_date` futura como "nacido, día 0" en vez de
  "en camino"; corregido, y ese resultado (`isBorn`, nuevo computed en
  `DashboardView.vue`) es ahora la única fuente de verdad para ocultar
  todas esas secciones hasta que el bebé haya nacido de verdad.
- La barra de accesos rápidos (Toma/Sueño/Pañal/Medida/Hito) vivía
  renderizada al final de todo el contenido del dashboard con
  `position: sticky`, así que solo empezaba a "pegarse" cuando el
  scroll llegaba casi al fondo — en la práctica, no flotaba sobre la
  línea temporal ni sobre nada anterior. Ahora se teletransporta a
  `<body>` y es `fixed` de verdad (mismo patrón que los botones
  flotantes de `ContractionsView.vue`), visible desde que se carga el
  dashboard.
- El enlace "Tu cuenta" del avatar (`AppHeader.vue`) no hacía nada
  fuera del dashboard — la hoja vivía solo dentro de
  `DashboardView.vue`, así que en `/contracciones` (o cualquier otra
  vista) el click activaba la bandera compartida `ui.accountSheetOpen`
  pero no había ningún `<BottomSheet>` escuchándola ahí. Se extrae
  toda la hoja a `AccountSheet.vue`, montado una sola vez en `App.vue`
  junto a `AppHeader`, para que funcione desde cualquier ruta.
- Editar una contracción que empieza y acaba en el mismo minuto daba
  un error al guardar: `UpdateContractionRequest` exigía `ended_at`
  estrictamente posterior a `started_at`, pero el campo
  `datetime-local` del frontend solo tiene precisión de minuto, así
  que una contracción real de menos de un minuto quedaba con ambos
  valores exactamente iguales. Cambiado a `after_or_equal` — la
  duración de "00:00:00" que se ve en ese caso es correcta, no un
  fallo aparte.
- Las predicciones de sueño/tomas del dashboard no se actualizaban al
  registrar o borrar una toma o un sueño, solo al recargar la página —
  el sondeo de 5s solo vuelve a pedir la línea temporal, y
  `onSubmitFeed`/`onSubmitSleep`/`onDeleteEntry` tampoco refrescaban la
  predicción tras guardar o borrar. Ahora sí, como una petición aparte
  que no bloquea el guardado ni cuenta como error si falla.
- `api/.env.example` traía `APP_NAME=Laravel` sin tocar, pese a que
  producción (Render) sí tiene puesto `APP_NAME=PequeDex` correctamente
  — solo afectaba a quien clonara el repo de cero contra el ejemplo, no
  a nada real ya desplegado. Encontrado revisando los tres proyectos del
  mismo workspace de Render con el mismo criterio usado en
  MIRA_MarketLens (donde sí era un fallo real de producción: el email de
  restablecer contraseña firmaba como "Laravel").
- Hallazgo de una auditoría de seguridad: las fotos de hitos se servían con la URL
  pública permanente del disco (`Milestone::photoUrl()`), y en producción ese disco es
  un bucket de Cloudflare R2 configurado como público — R2 no tiene ACL por objeto
  como S3, así que un bucket público sirve *todos* sus objetos, sin más control que lo
  impredecible del nombre de archivo. Son fotos de bebés. `photoUrl()` ahora pide una
  URL firmada con 30 minutos de validez cuando el disco lo soporta
  (`Storage::disk(...)->providesTemporaryUrls()`), en vez de la URL pública fija; en
  local (disco `public`) sigue devolviendo la URL normal, ya que ese disco no soporta
  firmarlas. **Esto no cierra el hueco por sí solo**: una URL firmada sobre un bucket
  que sigue siendo público no protege nada (el objeto es alcanzable igual sin la
  firma) — hace falta además poner el bucket en privado en el propio Cloudflare, fuera
  de alcance de este commit (solo el código). **Hecho** (fuera de este repo, sin commit
  propio): el bucket `pequedex-milestones` no tiene "Public Development URL" habilitada
  ni ningún Custom Domain asignado — confirmado en el panel de R2, solo accesible ya vía
  la API S3 firmada.
- Hallazgos de una auditoría API/código/documentación/estilos/diseño/seguridad completa
  del proyecto: `README.md` y `api/README.md` seguían mencionando Cloudflare Pages como
  frontend en un punto, pese a que la nota de migración a GitHub Pages ya estaba
  documentada más arriba en el mismo fichero; el mensaje de error de
  `BabyController@leave` seguía diciendo "abandonarlo" tras el cambio de wording ya
  aplicado en el resto de la UI ("dejar de cuidar"); `BottomSheet.vue` no anunciaba a
  qué hoja correspondía el diálogo para un lector de pantalla (solo "dialog", sin
  ningún título hasta leer el contenido) — ahora referencia el primer encabezado de la
  hoja que se abre vía `aria-labelledby`, generándole un id con `useId()` si no tenía
  uno. Un quinto hallazgo (`#ef4444` fijo en el corazón de "me gusta" de
  `MilestoneStoryViewer.vue`) resultó ser intencional y no un descuido: este visor
  flota a pantalla completa sobre la foto del hito con el resto de la cabecera también
  en colores fijos, así que se documenta con un comentario en vez de "corregirlo". Un
  sexto hallazgo (`web/src/stores/babies.ts`, un cast a `Contraction` marcado como
  "redundante") también se descartó tras revisarlo: `apiClient` no está tipado
  (`axios.create()` sin genéricos), así que quitar el cast cambiaría silenciosamente el
  tipo de retorno de `startContraction()` de `Contraction` a `any` — sería una
  regresión de tipado, no una limpieza.
- Hallazgos de una auditoría de código: `POST /babies` era el único endpoint de
  escritura sin ningún límite de peticiones (ahora `throttle:10,1`, igual que el resto),
  y `BabyController::store()` creaba el `Baby` y vinculaba al cuidador en dos pasos sin
  transacción — un fallo entre medias dejaba un `Baby` huérfano sin ningún cuidador,
  inaccesible para siempre. Ambos pasos van ahora dentro de `DB::transaction()`.