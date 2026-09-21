# PequeDex Web

SPA en Vue 3 (Composition API, Pinia, Vue Router, TypeScript) para
[PequeDex](../README.md). Consume la [API](../api/README.md) por HTTP con
un token Bearer guardado en `localStorage`.

## Instalación

```bash
npm install
cp .env.example .env.local   # ajusta VITE_API_URL si la API no corre en localhost:8000
npm run dev
```

## Scripts

```bash
npm run dev          # servidor de desarrollo
npm run build         # type-check (vue-tsc) + build de producción
npm run lint          # ESLint (con --fix)
npm run format         # Prettier (con --write)
npm run test:unit      # Vitest
```

El CI corre estos cuatro por separado en el job de frontend, y el de
formato en modo comprobación (`npx prettier --check src/`, sin
`--write`) — a diferencia de `npm run format`, ese falla si algo no
está ya formateado en vez de arreglarlo. Antes de hacer push conviene
correr `npm run format` (o el `--check` directamente) además de
`build`/`lint`/`test:unit`: el CI ya falló una vez por esto exactamente
porque la verificación local solo cubría los otros tres.

## Estructura relevante

- `src/lib/api.ts` — instancia de axios con interceptor que añade el token
  Bearer a cada petición, y cierra sesión automáticamente ante un 401.
- `src/stores/auth.ts` — sesión (usuario + token), registro/login/logout, y
  restauración de sesión al recargar la página. También datos
  personales, cambio de contraseña y foto de perfil (`updateProfile`/
  `updatePassword`/`uploadAvatar`/`removeAvatar`) — mismo patrón que
  MIRA MarketLens, pero la foto se guarda como `data:` URI en una
  columna de `users`, no en disco (ver `api/README.md`).
- **`UserAvatar.vue`** — foto de perfil circular (`object-fit: cover`,
  a diferencia del `UserLogo.vue` de MIRA MarketLens, que no recorta
  porque un logo de empresa no es necesariamente cuadrado); sin foto,
  un círculo con la inicial del nombre sobre `--brand` — que ya
  reacciona solo al tema según el sexo del bebé (ver más abajo), así
  que el avatar "combina" gratis con el resto de la app.
- `src/App.vue` — al montar la app, si hay un token guardado pero no un
  `user` en memoria (recarga de página), pide `/api/user` una sola vez
  desde la raíz — vive ahí para que funcione sin importar en qué pantalla
  aterrice la recarga, no solo en el dashboard.
- `src/views/{Login,Register}View.vue` — formularios con la identidad
  visual del proyecto, probados de punta a punta contra la API real.
- `src/stores/babies.ts` — el bebé del usuario (crear/unirse por código),
  su línea temporal combinada, y CRUD completo de tomas/sueño/pañales
  (`updateFeed`/`updateSleep`/`updateDiaperChange` reutilizan el mismo
  tipo de payload que su `create*`, igual que ya hace el backend - ver
  la nota de `UpdateFeedRequest` en `api/README.md`). Cada acción de
  crear/editar/borrar vuelve a pedir la línea temporal entera en vez de
  tocar el array local a mano — el otro cuidador puede haber añadido
  algo entre medias, y el sondeo (ver más abajo) va a traer esa misma
  lista de todos modos. Mismo patrón para crecimiento e hitos (listas
  propias, no mezcladas en la línea temporal): crear/borrar vuelve a
  pedir la lista entera. `createMilestone()` construye un `FormData` a
  mano en vez de mandar JSON porque la foto es un archivo real, no una
  URL.
- **Varios bebés por cuidador** (`babies.ts`, `src/lib/activeBaby.ts`)
  — el backend ya soportaba esto (`baby_user` es muchos-a-muchos), el
  hueco estaba en el frontend: `fetchCurrent()` cogía siempre
  `data[0]`. Ahora guarda la lista completa en `babies` y cuál está
  activo en `current`, restaurado desde `localStorage`
  (`pequedex_active_baby`, mismo patrón que la preferencia de idioma en
  `i18n.ts`) si ese bebé sigue entre los suyos - no siempre el primero,
  por si el orden cambia. `switchBaby()` solo cambia `current`; quien
  llama (`onSwitchBaby()` en `DashboardView.vue`) es responsable de
  recargar los datos propios del bebé (`loadBabyData()`), igual que ya
  hacía tras `create()`/`join()`. El selector en sí
  (`DashboardView.vue`, fila de chips sobre la cabecera) solo se
  renderiza con más de un bebé — cero cambio visual para el caso normal
  de uno solo. "Añadir otro bebé" (en los ajustes del bebé activo) abre
  una hoja con los mismos formularios de crear/unirse del onboarding
  inicial (`onCreateBaby()`/`onJoinBaby()` reutilizados tal cual, con un
  `closeSheet()` añadido que no hace nada cuando se llaman desde la
  pantalla de onboarding, donde no hay ninguna hoja abierta).
- `src/views/DashboardView.vue` — onboarding (crear un bebé o unirse con
  código) cuando el usuario no tiene ninguno todavía, y si ya lo tiene:
  botones de registro rápido (toma/sueño/pañal/medida/hito, con la hora
  actual precargada) más la línea temporal, la predicción de sueño, y
  las listas de crecimiento e hitos. `loadBabyData()` (línea temporal +
  crecimiento + hitos + predicción) se llama tanto en `onMounted` como
  justo después de crear/unirse a un bebé, mostrando `loading` en los
  dos casos — antes solo se llamaba al montar el componente, así que
  unirse a un bebé con historial real (justo el caso de uso de unirse,
  a diferencia de crear uno) se quedaba sin cargarlo hasta recargar la
  página a mano. Sondea `/timeline` cada 5 segundos
  mientras la vista está montada — mismo patrón que el import de BGG en
  LudoDex, sin websockets ni infraestructura nueva — para que lo que
  registre un cuidador aparezca en la pantalla del otro sin recargar
  (crecimiento/hitos/predicción no están en ese sondeo todavía: cambian
  con mucha menos frecuencia que tomas/sueño/pañales) — la predicción
  sí se refresca aparte, como una llamada de fondo que no bloquea el
  guardado, cada vez que se crea/edita/borra una toma o un sueño
  (`onSubmitFeed`/`onSubmitSleep`/`onDeleteEntry`): antes solo se
  cargaba una vez al entrar en el dashboard, así que se quedaba con
  los datos iniciales hasta recargar la página a mano aunque el
  registro nuevo sí apareciera al momento en la línea temporal. Los
  cinco campos
  de fecha (toma/sueño/pañal/medida/hito) llevan `:min` calculado a
  partir de `babies.current?.birth_date` (`minDate`/`minDateTime`,
  `undefined` si el bebé todavía no tiene fecha de nacimiento): nada de
  eso tiene sentido antes de que el bebé haya nacido, y el propio
  navegador bloquea el envío con su aviso nativo si se intenta. La API
  aplica la misma regla por su cuenta (ver `api/README.md`), no solo el
  frontend. Tocar una fila de la línea temporal (o de la lista de
  crecimiento) abre el mismo formulario de registro rápido precargado
  (`openFeedEdit()`/`openSleepEdit()`/`openDiaperEdit()`/
  `openGrowthEdit()`, un `editing*Id` por tipo — mismo patrón que ya
  tenía el hito), no solo verla/borrarla; `EntryCard.vue` envuelve su
  contenido en un botón propio para que el icono de borrar (fuera de
  ese botón, no dentro) siga siendo un control independiente. Los tres
  campos `datetime-local` (toma/sueño/pañal, no medida/hito, que solo
  llevan fecha) pasan por `toLocalInputValue()`/`toUtcIso()` en ambas
  direcciones: el backend corre en `app.timezone=UTC`, pero un
  `datetime-local` no lleva zona horaria propia, así que mandar su
  valor tal cual hacía que el servidor lo tomara como si ya fuera UTC
  en vez de hora local - se descubrió al editar sin tocar la hora y ver
  que igualmente se desplazaba en cada guardado. El avatar en
  `AppHeader.vue` abre una hoja de "Tu cuenta" (datos personales,
  idioma, barra de accesos, contraseña, foto) - `AccountSheet.vue`,
  montada una sola vez en `App.vue` junto al propio `AppHeader`, no
  dentro de `DashboardView.vue` como al principio: `AppHeader` es
  global y no puede llamar a una función local de una vista concreta,
  así que el abrir/cerrar cruza ese límite vía `stores/ui.ts` - un
  store deliberadamente mínimo (un booleano y dos acciones). Vivir
  dentro de `DashboardView.vue` era justo el bug real encontrado en
  producción: desde cualquier otra ruta (`/contracciones`, por
  ejemplo) el click ponía la bandera a `true`, pero no había ningún
  `<BottomSheet>` escuchándola ahí, así que no pasaba nada visible. El
  wordmark "👶 PequeDex" se queda siempre a la izquierda; a la derecha,
  en cuanto hay cuenta y bebé, el toggle de tema, el avatar (sin el
  nombre al lado) y "Cerrar sesión" como icono, en ese orden. El código
  de invitación
  (`inviteCodeExpanded`) empieza siempre colapsado y no se recuerda
  entre visitas — solo hace falta una vez, al vincular al otro
  cuidador, y esa tarjeta se ve en cada visita al dashboard. Tocar el
  nombre del bebé lo despliega; el botón de sexo/fecha de nacimiento,
  al lado, es un control aparte que no colapsa ni expande nada al
  pulsarlo.
- **Contador de contracciones** (`src/views/ContractionsView.vue`,
  `src/components/ContractionTimeline.vue`, ruta `/contracciones`) —
  vista propia, no una categoría más de la barra de accesos: el
  cronómetro en vivo y la línea temporal con intervalos no encajan en
  el patrón de hoja-inferior del resto de categorías, y solo tiene
  sentido antes de nacer el bebé. Se enlaza desde una tarjeta en el
  dashboard visible solo mientras `babies.current.birth_date` está
  vacío — desaparece sola en cuanto se rellena, sin quedar como enlace
  muerto. `lib/contractionStats.ts` es una función pura (ventana de los
  últimos 60 minutos) para "veces por hora / duración media / intervalo
  medio", testeable sin montar Pinia. `ContractionsView.vue` mantiene un
  único `now` (un `setInterval` de 1s) que pasa como prop a
  `ContractionTimeline.vue`, para que el contador en vivo de la fila
  activa y las estadísticas del encabezado no se desincronicen por
  llevar cada uno su propio intervalo. Ese mismo `now` alimenta
  `sinceLastLabel` ("Desde la última: mm:ss", justo encima de la fila
  más reciente de la línea temporal — vivió primero sobre el botón de
  inicio, en la barra flotante, pero quedaba lejos de la contracción a
  la que se refiere): mientras no hay ninguna contracción en marcha
  pero ya existe una anterior, cuenta en vivo el tiempo transcurrido
  desde su `ended_at` - desaparece en cuanto se inicia una nueva y
  vuelve a empezar desde cero al detenerla, sin dato nuevo que guardar
  (es el mismo cálculo que ya hacía `ContractionTimeline.vue` para el
  chip de intervalo, solo que en vivo en vez de a posteriori). Ese
  mismo chip de intervalo pasa el umbral de "demasiado largo" de 50 a
  60 minutos (`LONG_GAP_MINUTES`, también en el PDF exportado). La
  hoja de edición usa `toLocalInputValueWithSeconds()` (hermana de
  `toLocalInputValue()`, que se queda igual para el resto de
  formularios del dashboard) junto con `step="1"` en sus dos campos,
  para poder ajustar los segundos de inicio/fin, no solo el minuto -
  sin esto los segundos reales se perdían nada más abrir la hoja.
  Intensidad en 3
  niveles — Leve/
  Moderada/Intensa — en vez de los 4 del original de referencia (pedido
  explícito). El registro de rotura de bolsa de aguas
  (`babies.current.water_broke_at`, vía `updateBaby()`, sin acción de
  store nueva) mejora el original en dos puntos pedidos: se ve la fecha
  completa además de la hora, y es editable, no solo "restablecer".
  `lib/datetimeInput.ts` (extraído de `DashboardView.vue`, que antes lo
  definía inline) centraliza `toLocalInputValue`/`nowForInput`/
  `toUtcIso`, reutilizado ahora por ambas vistas. La exportación a PDF
  (`babies.exportContractionsPdf()`) pide el endpoint con
  `responseType: 'blob'` en vez de un `<a href>` directo — la API usa
  token Bearer, no cookies, así que un enlace normal no llevaría la
  cabecera de autorización — y dispara la descarga con un `<a download>`
  temporal sobre un `URL.createObjectURL(blob)`. Bug real encontrado
  al probar en vivo: `ContractionController@store` no pasaba
  `ended_at` a `create()`, así que Eloquent omitía la clave del JSON
  de respuesta en vez de mandar `null` — como el frontend detecta la
  contracción en marcha comparando `ended_at === null`, el botón de
  inicio/detener se quedaba atascado y `contractionStats.ts` contaba
  la fila activa como "completada", dando `NaN:NaN` en la duración
  media (ver la nota del mismo problema con `intensity` en
  `api/README.md`). `ContractionTimeline.vue` fue rediseñado tras una
  segunda pasada para acercarse más a la app de referencia: filas en
  píldora con la hora y el número de contracción grandes junto al
  círculo (conectados por una línea gruesa), duración/intensidad/menú
  más discretos dentro de la píldora, separador de día entre grupos, y
  chip de intervalo alineado a la derecha en vez de centrado. Los
  botones de "Inicio de contracción"/"Detener" y de rotura de bolsa
  dejaron de estar en el flujo normal de la página y pasaron a un pie
  fijo teletransportado a `<body>` (mismo patrón que `BottomSheet.vue`,
  para no depender de que ningún ancestro tenga `transform`), flotando
  sobre el historial en la parte inferior de la pantalla. `sinceLastLabel`
  pasó luego por dos ajustes: primero a la misma píldora con borde
  alineada a la derecha que usan los chips de intervalo (antes texto
  centrado aparte), congelando su texto en "> 60 min" al superar
  `LONG_GAP_MINUTES` sin dejar de contar por debajo; después de
  `ContractionsView.vue` a `ContractionTimeline.vue` como prop, porque
  vivir antes del propio componente la dejaba pegada al separador de
  día en vez de a la fila de la contracción cuando esta era de un día
  distinto al de "ahora". El icono de la tarjeta de enlace del
  dashboard cambió de una gota (ya usada dentro de esta misma vista
  para la rotura de bolsa de aguas, así que sugería "agua") a un
  cronómetro. Nuevo botón "Eliminar todas las contracciones" en los
  ajustes del bebé (`DashboardView.vue`, junto a "Abandonar este
  bebé", mismo patrón de confirmación en dos pasos), que llama a
  `babies.deleteAllContractions()` — útil tras una falsa alarma, sin
  tener que borrar fila por fila. El PDF exportado se ordenó de más
  reciente a más antigua (igual que en pantalla — antes salía al
  revés) y recibió una pasada de legibilidad para papel: tipografía
  más grande, separador de día centrado, columnas reequilibradas
  (duración más estrecha, el resto más ancho) y contenido alineado a
  la derecha. Ganó también cabecera con estadísticas y fecha de
  generación, pie de página con el logo de la app, y la rotura de
  bolsa de aguas integrada como una fila más en su hueco cronológico
  dentro de la propia línea temporal, en azul para distinguirse como
  evento aparte (ver `api/README.md` para el detalle del lado
  backend).

## Idioma

`src/i18n.ts` configura `vue-i18n` con español e inglés — ver la nota de
arquitectura en el README raíz sobre por qué solo estos dos, a
diferencia de los 5 idiomas de LudoDex/MIRA. Sin selector rápido en la
cabecera (se quitó para ganar espacio en el nav, y porque quien usa la
app a diario no va a cambiar de idioma mientras la usa): cambiarlo es
ahora un control segmentado más dentro de "Tu cuenta"
(`DashboardView.vue`, junto a nombre/email), que llama a `storeLocale()`
y persiste la elección en `localStorage` bajo la clave `pequedex_locale`.
Login/registro no tienen cuenta todavía donde guardar esa preferencia,
así que `getStoredLocale()` cae al idioma del navegador
(`navigator.language`) en vez de forzar español — mismo patrón que
MIRA MarketLens — y solo usa lo guardado si el usuario ya lo cambió
alguna vez desde "Tu cuenta". Los mensajes viven en
`src/locales/{es,en}.ts`; los valores de los enums del backend
(`izquierdo`/`derecho`/`ambos`, `mojado`/`sucio`/`ambos`) se traducen en
el punto de uso — son valores internos en español, no texto de interfaz.

## Barra de accesos personalizable

Cada cuidador elige qué categorías (toma/sueño/pañal/crecimiento/hito)
quiere ver en la barra de accesos rápidos del dashboard, desde "Tu
cuenta" (`DashboardView.vue`, junto al selector de idioma) — a
diferencia del idioma, esto sí vive en el backend
(`auth.updateActionBarCategories()` → `PUT /user/action-bar`, ver
`api/README.md`), porque afecta a qué bloques se ven y no solo al
texto de la interfaz. Cada categoría es un botón-toggle (el propio
icono, no un checkbox aparte): relleno sólido con el color de la
categoría y una marca de verificación cuando está activa, contorno
gris cuando no. El guardado es al vuelo, igual que el idioma — sin
deshabilitar el resto de iconos mientras la petición está en curso
(eso hacía parpadear los 5 en cada pulsación en una versión anterior),
solo revierte si la petición llega a fallar de verdad.

Con un mínimo de 3 categorías (`MIN_ACTION_BAR_CATEGORIES` en
`lib/category.ts`, igual que el `min:3` del backend): al llegar al
mínimo, el icono de cada categoría todavía activa se deshabilita en
vez de dejar que el usuario llegue al error de validación del
servidor. `ActionBar.vue` no solo quita el icono de la categoría
desactivada — con menos elementos, el resto crece de forma notable
(32px con las 5, 44px con 4, 56px con 3) en vez de dejar hueco vacío
en la barra, con el texto y el padding del contenedor escalando junto
al icono. Las secciones del dashboard ligadas a una categoría
desactivada (predicción y semana de sueño, lista de crecimiento,
hitos) también dejan de renderizarse, igual que su acceso rápido.

## Diseño

Tailwind CSS v4 (`@tailwindcss/vite`, configuración CSS-first vía
`@theme` en `src/assets/base.css`) con una identidad propia pensada para
el uso real de la app — registrar algo con una mano a las 3am —, no para
verse bien en una captura:

- **Tokens en `src/assets/base.css`**: paleta cálida (marca en rosa
  empolvado + verde azulado, nada de crema+terracota genérico) con un
  color semántico por categoría de registro (toma/sueño/pañal/
  crecimiento/hito) — no decorativo: permite escanear la línea temporal
  por color e icono sin leer cada línea. Los tokens son variables CSS
  planas (`--brand`, `--feed`, etc.), no valores directos de `@theme`,
  precisamente para poder repintarlas en tiempo de ejecución con el
  cambio de tema (ver más abajo) — `@theme` solo las referencia
  (`--color-brand: var(--brand)`), porque sus propios valores quedan
  fijados en el CSS generado en tiempo de compilación.
- **Tipografía**: Quicksand (redondeada, cálida) solo para titulares;
  el resto usa la fuente del sistema — carga instantánea y cifras
  tabulares (`tabular-nums`) para pesos, percentiles y horas.
- **Interactividad** — pasada inspirada en cómo se hizo en LudoDex/MIRA
  MarketLens, pero adaptada a esta app (ninguna de las dos usa
  Tailwind, así que nada es un copia-pega literal): `.btn-primary`/
  `.btn-ghost`/`.card-interactive` en `base.css` dan elevación al pasar
  el ratón y un `scale(0.96-0.985)` al pulsar, en vez de solo cambiar
  de color. `EntryCard.vue` añade `.card-interactive` con un anillo del
  color de su categoría al pasar el ratón, y la línea temporal entera
  entra/sale con un `TransitionGroup` (`entry-list-*` en `base.css`,
  global — no `scoped`, porque `TransitionGroup` aplica esas clases al
  elemento raíz de cada `EntryCard`, no dentro de su propio árbol de
  estilos). `AppHeader.vue` celebra un guardado con éxito con un
  bote-y-giro de un solo disparo en la marca (`@keyframes mark-pop`,
  distinto de los bucles `footprint-bob`/`heartbeat` ya existentes,
  usados solo en la pantalla de carga) — el mismo truco de
  "desactivar y reactivar en el siguiente frame" que usa LudoDex para
  poder repetir la animación en guardados seguidos. `ToastNotification.vue`
  gana un icono y un color por tipo (`toast.show(mensaje, 'error')`,
  antes todo salía en el mismo verde de éxito). Todo con su reserva
  bajo `@media (prefers-reduced-motion: reduce)`.
- **Jerarquía visual** — la pasada de interactividad de arriba no bastó
  por sí sola: la app seguía leyendo "plana" porque cada sección era el
  mismo bloque blanco de mismo tamaño apilado, sin nada que rompiera el
  ritmo. `TodaySummary.vue` (justo bajo la cabecera del bebé) resuelve
  eso con una fila de estadísticas de hoy en relleno sólido por
  categoría y cifras grandes (`font-display text-xl`) — el primer sitio
  de la página con una escala tipográfica real, no texto uniforme. El
  fondo de `body` en `base.css` pasa de `--surface-sunken` plano a ese
  mismo tono más dos veladuras radiales fijas (`background-attachment:
  fixed`) en `--brand`/`--brand-teal` vía `color-mix()`, muy tenues,
  para que las tarjetas blancas lean como si flotasen sobre algo en vez
  de fundirse con el fondo. Los títulos de sección sueltos (Hitos,
  Línea temporal, Crecimiento) ganan una barrita de acento de color
  junto al texto.
- **`src/theme.ts` / `ThemeToggle.vue`**: claro/oscuro/sistema,
  persistido en `localStorage` (`pequedex_theme`) y aplicado antes del
  montaje en `main.ts` para que no parpadee el tema equivocado en la
  primera pintura. El oscuro no es un extra estético: es quien de
  verdad se usa de noche para las tomas.
- **Mobile-first con hoja inferior**: `ActionBar.vue` (barra fija con
  los 5 registros rápidos, alcanzable con el pulgar) abre un
  `BottomSheet.vue` por encima del contenido en vez de un formulario
  que empuje la página — mismo patrón que cualquier app nativa. Los
  `<select>` de tipo (toma/pañal/sexo) son `SegmentedControl.vue`, no
  desplegables. `src/lib/bodyScrollLock.ts` bloquea el scroll del
  `body` mientras cualquier hoja está abierta (mismo arreglo que
  LudoDex's `GameDetailModal` para el mismo fallo: un dedo sobre el
  fondo oscuro movía el dashboard por debajo) — vive en un módulo
  aparte, con contador de referencias, porque `DashboardView.vue`
  tiene varias `BottomSheet` montadas a la vez y el estado de
  `<script setup>` no se comparte entre instancias de un componente.
- **`PasswordField.vue`** — todos los campos de contraseña (login,
  registro y su confirmación) llevan el icono de ojo para mostrar/
  ocultar, no solo el de login.
- **`EntryCard.vue` / `CategoryIcon.vue` / `src/lib/category.ts`** —
  la tarjeta compartida por línea temporal y crecimiento, con su franja
  de color por categoría. Las clases de Tailwind por categoría
  (`text-feed`, `bg-feed/15`, …) están en `category.ts` como tablas de
  búsqueda literales, no interpoladas (`` `text-${category}` ``): el
  escáner de Tailwind solo detecta nombres de clase que aparecen tal
  cual en el código fuente.
- **Hitos como diario interactivo** — los hitos no usan `EntryCard`, y su
  detalle ya no es una `BottomSheet` más: es el único de los cinco
  registros con categoría, reacciones y un visor propio a pantalla
  completa, porque es el único pensado para volver a mirarlo, no solo
  para consultarlo.
  - **`MilestoneStories.vue`** — fila de círculos con anillo degradado
    (foto o emoji de categoría dentro,
    `src/lib/milestoneCategory.ts` como tabla de búsqueda literal,
    mismo motivo que `category.ts` para las clases de Tailwind) más un
    círculo "+" para crear uno nuevo, estilo Instagram Stories — sube
    los hitos arriba del todo del dashboard en vez de dejarlos
    enterrados tras la línea temporal y el crecimiento. Sustituye a la
    cuadrícula original (`MilestoneCard.vue`, eliminada por completo,
    no queda como código muerto sin usar).
  - **Formulario guiado, no en blanco** — "+ Hito" pide primero la
    categoría como chips (no `SegmentedControl.vue`: sus columnas
    iguales no dejan sitio a 5 etiquetas en español en un móvil de
    360px). Elegir una sugiere un título (`selectMilestoneCategory()`
    en `DashboardView.vue`, que solo sobrescribe el título si sigue
    vacío o es su propia sugerencia anterior — nunca pisa lo que el
    usuario ya escribió) y cambia el *placeholder* de la descripción a
    una pregunta concreta por categoría
    (`dashboard.milestoneForm.categoryPrompts.*` en los locales).
  - **`MilestoneStoryViewer.vue`** — pantalla completa, no una hoja:
    foto sin recortar (`object-contain`) o un degradado del color de
    "hito" con el emoji de la categoría en grande si no hay foto.
    Navegación entre hitos por gesto (`touchstart`/`touchend`, sin
    librería), flechas y teclado (←/→/Escape). `DashboardView.vue`
    guarda el id del hito que se ve (`viewingMilestoneId`), no el
    objeto — un `computed` lo busca en `babies.milestones` en cada
    render, así que sobrevive a un refetch (tras dar un "me encanta") y
    se cierra solo si el id deja de existir en la lista (borrado desde
    el otro cuidador). Reutiliza `bodyScrollLock.ts`. Su botón "Editar"
    reutiliza el mismo formulario de "+ Hito" (`openMilestoneEdit()`),
    precargado con los datos actuales incluida la categoría.
  - **Reacciones** — un corazón en el visor llama a
    `babies.toggleMilestoneLike()`, que sigue el mismo patrón de
    "refetch tras mutar" que el resto del store. Quién ha reaccionado
    se ve como una pila de `UserAvatar.vue` con sus nombres debajo del
    corazón.
- **Portada "Hoy con {nombre}"** — la tarjeta del bebé (arriba del
  dashboard) muestra un titular con su edad en vez de solo su nombre:
  `src/lib/babyAge.ts` calcula días (menos de dos semanas) o semanas
  desde `birth_date`, o la cuenta atrás hasta `due_date` si aún no ha
  nacido — parseando ambas como fecha de calendario local, no con `new
  Date(iso)` directamente, que trata una fecha sin hora como medianoche
  UTC y puede desplazar el día según la zona horaria de quien mire la
  app. El nombre del bebé pasa a la etiqueta pequeña ("Hoy con
  Violeta"); tocarla sigue desplegando el código de invitación igual
  que antes. El botón de ajustes (antes con el sexo y la fecha como
  su propia etiqueta, repitiendo lo que la tarjeta ya mostraba) pasa a
  ser solo un icono de lápiz, a la izquierda del chip de sexo
  (`heroSexLabel`, emoji incluido: "🌸 Niña"/"💙 Niño") — ambos viven
  en un bloque posicionado en la esquina (`absolute top-5 right-5`),
  no dentro del botón principal, para que este último pueda ocupar el
  ancho completo de la tarjeta. La fecha de nacimiento (`heroDateLabel`)
  se coloca a la misma altura que la edad, no debajo (`items-baseline`
  para que ambas líneas de texto compartan línea base), y llega hasta
  el borde derecho real de la tarjeta con `justify-between` — antes
  vivía dentro de un botón de ancho `flex-1` compartiendo fila con el
  icono/chip, así que solo llegaba hasta donde empezaba esa columna,
  no hasta el borde real. El propio texto de la fecha usa formato
  largo (`{ day: 'numeric', month: 'long', year: 'numeric' }` en
  `toLocaleDateString()`, no la llamada sin opciones): "Nació el 31 de
  agosto de 2026", no "31/8/2026" — `Intl` añade los conectores
  "de...de" en español solo, sin tener que escribirlos a mano.
- **`DailyRhythm.vue`** — franja de 00 a 24h con los tramos de sueño y
  las marcas de toma/pañal de *hoy* (el día de calendario, no las
  últimas 24h en bruto), calculada en el propio componente a partir de
  la `babies.timeline` que el dashboard ya pedía — ninguna llamada
  nueva a la API. Una siesta sin `ended_at` (en curso) se recorta a
  "ahora" en vez de extenderse hacia el resto del día, que todavía no
  ha pasado. Gana flechas prev/next (la de avanzar se desactiva en
  "hoy") para navegar a días anteriores: recibe `day`/`isToday` como
  props en vez de calcular siempre "hoy" internamente, y
  `DashboardView.vue` guarda el día mostrado en `rhythmDate`
  (reseteado a hoy en cada `loadBabyData()`). Mientras se ve "hoy"
  sigue leyendo de `babies.timeline` (el sondeo de 5s, sin tocarlo); al
  navegar a otro día pasa a `babies.dayTimeline`, pedido aparte vía
  `fetchDayTimeline(date)` contra el nuevo parámetro `?date=` de
  `TimelineController@index` (ver `api/README.md`), que devuelve todo
  lo que se solape con ese día sin el límite habitual de "las N más
  recientes". Nuevo `lib/localDate.ts` para esta aritmética de fechas
  en hora local, no UTC — la ventana `[00:00, 24:00)` que ya usaba
  `DailyRhythm.vue` es local, así que la fecha que se compara y se
  manda al backend tiene que estarlo también.
- **`EntryCard.vue`** cambia el borde de color fino por un lavado de
  fondo del color de categoría (`categoryBg`, ya existente) en toda la
  fila; el icono pasa a un chip semitransparente (`bg-surface/70`) para
  no perderse contra ese mismo fondo. `categoryBorder` se retira de
  `category.ts` al quedarse sin ningún uso.
- **`ActionBar.vue`** pasa de barra plana pegada al borde inferior a
  una pastilla flotante (`rounded-full`, sombra propia, margen lateral)
  — se siente a controles de una app nativa, no a la barra de acciones
  de un formulario web. Bug real encontrado en vivo: vivía renderizada
  al final de todo el contenido con `position: sticky`, así que solo
  empezaba a "pegarse" con el scroll casi en el fondo del dashboard, no
  flotaba de verdad sobre la línea temporal ni nada anterior. Se
  teletransporta a `<body>` y pasa a `fixed` (mismo patrón que los
  botones flotantes de `ContractionsView.vue`, para no depender de que
  ningún ancestro tenga `transform`), envuelta en su propio
  `mx-auto max-w-md` ya que fuera del flujo normal pierde el contexto
  de ancho que le daba su contenedor.
- **`isBorn`** (`DashboardView.vue`, `babyAgeInfo.value.type ===
  'born'`) es la única fuente de verdad para "hay un bebé real que
  trackear" - condiciona todo lo que va después de la tarjeta de
  "Contador de contracciones" (estadísticas de hoy, ritmo, sueño de la
  semana, línea temporal, predicciones, crecimiento, hitos, la propia
  `ActionBar`): antes solo esa tarjeta miraba `birth_date`, y el resto
  se veía igual con o sin bebé nacido. Cubre tanto la falta de
  `birth_date` como una `birth_date` futura (fecha elegida de
  antemano, o una fecha prevista puesta en el campo equivocado) -
  `getBabyAge()` clasificaba antes ese segundo caso como "nacido, día
  0" en vez de "en camino".
- **`WeeklySleep.vue`** — una barra por cada uno de los últimos 7 días
  de calendario con las horas de sueño totales de ese día, justo bajo
  el "Ritmo de hoy": ver el patrón de la semana de un vistazo, no solo
  el día suelto. `src/lib/sleepHistory.ts` (con tests propios) hace el
  reparto: un sueño que cruza la medianoche se cuenta en ambos días
  proporcionalmente a lo que ocupó en cada uno, no entero en el día en
  que empezó, y uno en curso se recorta a "ahora" en vez de extenderse
  al resto del día. La altura de las barras se escala contra el propio
  máximo de la semana (con un suelo de 8h) para que una semana
  tranquila no salga toda "llena" contra un techo arbitrario.
  `babies.fetchRecentSleeps()` pide solo una ventana de 9 días (no todo
  el historial) vía el nuevo `?since=` de `SleepController::index` (ver
  `api/README.md`) — 2 días de margen sobre los 7 que se muestran, para
  que un sueño que cruza al primer día del gráfico no se quede cortado
  en el propio límite de la petición.
- **Onboarding sin cuenta accesible** — un usuario recién registrado
  sin bebé todavía no tenía forma de cerrar sesión ni de abrir "Tu
  cuenta": ambos botones de `AppHeader.vue` exigían
  `auth.user && babies.current`, y la propia hoja de "Tu cuenta" vivía
  dentro de la rama de `DashboardView.vue` que solo se monta con un
  bebé ya creado. La hoja sube a un nivel disponible en cualquier
  estado del onboarding, y ambos botones pasan a depender solo de
  `auth.user`.

## Marca de la pestaña

`index.html` traía sin tocar el `<title>Vite App</title>` y el favicon
genérico de Vue del scaffold inicial — quedó así varios bloques de
trabajo hasta notarlo. Un primer icono propio (trazo lineal, estilo
Feather, en `AppHeader.vue` y `favicon.svg`) resultó demasiado
ambiguo a tamaño de pestaña — no se distinguía qué representaba. Se
sustituyó por el emoji 👶 directamente: en la cabecera como texto
junto al nombre, y en `favicon.svg` centrado sobre un `<svg>` sin más
decoración — un emoji ya está diseñado para leerse con claridad a
tamaños minúsculos, cosa que un icono de trazo propio no garantiza.
`src/i18n.ts` mantiene `<html lang>` sincronizado con el idioma activo
(accesibilidad/SEO), no solo el `lang="es"` estático de `index.html`
que sirve de valor por defecto antes de que cargue el JS.

Ese emoji 👶 tampoco era definitivo: `AppMark.vue` lo sustituye por una
marca propia (huella de bebé con un corazón marcado en la planta) en el
mismo degradado `--brand` → `--brand-teal` que ya usa el resto de la
app, así que se retiñe sola con el sexo del bebé y el tema sin ningún
color nuevo que mantener. Expone dos pesos de la misma forma en vez de
forzar una sola a todos los tamaños: completa (con los cinco dedos)
para la cabecera y la pantalla de carga, y una reducida (sin dedos)
para `favicon.svg`, comprobada a 16-32px reales — ahí los dedos se
emborronaban en una mancha en vez de leerse como tales. La pantalla de
"Cargando…" del dashboard anima el mark (el corazón late con su propio
ritmo, la huella hace un ligero rebote de paso) en lugar de mostrar
solo texto, respetando `prefers-reduced-motion`. Como con la identidad
visual original, se propuso primero como maqueta con varias direcciones
y se aprobó antes de tocar código real.

## Tema según el sexo del bebé

`DashboardView.vue` calcula `themeSex` y pone `data-sex="nino"/"nina"/
"combo"` en `<html>` (se quita al desmontar la vista, p. ej. al cerrar
sesión). Cambia al momento al tocar el `SegmentedControl` del sexo, sin
esperar a "Guardar": mientras la hoja de ajustes está abierta usa el
valor todavía sin guardar del formulario; el resto del tiempo usa el
valor ya guardado del bebé. `base.css` retinta solo
`--brand`/`--brand-teal`/`--focus` (azul + verde salvia para "nino",
rosa/berenjena + malva para "nina"), con su propia variante clara y
oscura cada uno — el resto de tokens (fondo, texto, y los colores por
categoría de registro) no cambian: esos identifican lo que se
registra, no de quién es el bebé. "combo" mezcla ambos temas — un
acento morado/malva en general, y un degradado azul→rosa explícito en
la propia tarjeta del bebé — para cuando no hay sexo elegido (o, en
broma, para gemelos de ambos sexos). Sin bebé todavía (login/registro/
onboarding) no se pone ningún atributo y se ve la paleta neutra
original (rosa empolvado + verde azulado).

## Notificaciones

`src/stores/toast.ts` + `src/components/ToastNotification.vue`, mismo
patrón que LudoDex y MIRA MarketLens: un único mensaje sin cola (mostrar
uno nuevo reemplaza al que hubiera y reinicia el temporizador de 3s),
montado una vez en `App.vue` para que cualquier vista pueda llamar a
`toast.show(...)`. Color fijo (no reactivo al tema claro/oscuro): flota
sobre lo que sea que muestre el dashboard en ese momento, y un tinte
traslúcido o dependiente del tema no se leería igual de bien sobre
cualquier fondo. Se usa para confirmar acciones que antes eran
silenciosas — borrar una entrada, guardar sexo/fecha de nacimiento,
regenerar el código de invitación, crear o unirse a un bebé — no para
el *éxito* de los registros rápidos (toma/sueño/pañal/hito), donde la
propia hoja cerrándose y la entrada apareciendo en su lista ya es
confirmación suficiente. Sí para su *fallo*: esos `onSubmit*` no
llevaban ningún `catch` — si `babies.createX(...)` fallaba (red,
validación...), no pasaba nada visible, la hoja se quedaba abierta sin
ninguna pista de qué había ido mal (encontrado en real: subir un hito
con foto se quedaba así de "colgado" en el móvil - ver `api/README.md`
sobre `docker/uploads.ini`). Ahora cada uno muestra
`t('dashboard.saveError')` por toast si falla.

## Despliegue

En producción ([odeirz.github.io/PequeDex](https://odeirz.github.io/PequeDex/)):
GitHub Pages, desplegado por el job `deploy-pages` de
`.github/workflows/ci.yml` (`actions/upload-pages-artifact` +
`actions/deploy-pages`) en cada push a `main` — migrado desde Cloudflare
Pages el 2026-09-19 (`pequedex.pages.dev` quedó en un rango de IP de
Cloudflare inalcanzable desde varias redes, ver CHANGELOG). `VITE_API_URL`
apuntando a la API real en Render se pasa como variable de entorno del
propio step de build en el workflow (antes vivía como variable de build de
Cloudflare Pages) — Vite la incrusta en el bundle en build time, no se lee
en runtime.

GitHub Pages sirve un *project page* bajo `/PequeDex/`, no en la raíz del
dominio — `vite.config.ts` fija `base: '/PequeDex/'`, y el favicon en
`index.html` usa `%BASE_URL%favicon.svg` en vez de una ruta absoluta para
no quedar roto (Vite no reescribe automáticamente rutas `/…` sueltas en el
HTML, solo assets que él mismo procesa). Vue Router va en modo `history`
(URLs sin `#`), pero a diferencia de Cloudflare Pages, **GitHub Pages no
tiene *fallback* de SPA integrado** — cualquier ruta que no sea la raíz
devuelve un 404 real de servidor en un refresh o un enlace directo. Se
resuelve con la técnica estándar `spa-github-pages`: `public/404.html`
redirige codificando la ruta real en la query string, y un script en
`index.html` la restaura con `history.replaceState()` antes de que
vue-router arranque — el usuario nunca ve la página 404 ni un cambio
visible de URL.
