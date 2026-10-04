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
  `extractValidationMessage()` — bug real reportado en vivo: los
  formularios de registro rápido (toma/sueño/pañal/medida/hito) y la
  edición de contracciones capturaban cualquier fallo del guardado con
  un `catch` sin distinguir causa, y siempre mostraban el mismo toast
  fijo de "revisa tu conexión", tanto si era una caída de red real
  como si el backend había rechazado los datos por una validación real
  (la hora de fin anterior a la de inicio, por ejemplo) - el backend ya
  devuelve un mensaje concreto por campo (ver `api/README.md`), pero se
  descartaba sin más. Esta función devuelve el primer mensaje de campo
  de una respuesta 422 (o `null` si el error no es un 422, para que el
  `catch` de cada formulario siga usando su fallback genérico en los
  casos que sí son de conexión).
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
  ese botón, no dentro) siga siendo un control independiente. Los
  campos de fecha/hora (toma/sueño/pañal, no medida/hito, que solo
  llevan fecha) pasan por `toLocalInputValue()`/`toUtcIso()` en ambas
  direcciones, sigan siendo el `<input type="datetime-local">` nativo o
  `DateTimeWheel.vue` (ver más abajo) - el modelo es el mismo string en
  ambos casos: el backend corre en `app.timezone=UTC`, pero ese formato
  no lleva zona horaria propia, así que mandar su valor tal cual hacía
  que el servidor lo tomara como si ya fuera UTC en vez de hora local -
  se descubrió al editar sin tocar la hora y ver que igualmente se
  desplazaba en cada guardado. Inicio de toma, inicio de sueño y pañal
  usan `DateTimeWheel.vue` (tres `WheelColumn.vue` - día, hora,
  minuto - con sonido al deslizar, ver "Sonido y vibración al
  interactuar" más abajo); fin de sueño se queda con el
  `datetime-local` nativo de siempre, porque puede dejarse vacío a
  propósito ("sigue durmiendo"), algo que una rueda no representa sin
  un interruptor aparte. Una toma al pecho también lleva un selector de
  duración (`feedDurationOptions`, chips "Sin indicar"/10/20/30/45 min,
  mismo estilo que el color de las heces del pañal) - se manda como
  `feedStartedAt` + los minutos elegidos convertidos a un `ended_at`
  absoluto (`feedEndedAtIso()`), no como un valor aparte, así que si se
  toca la hora de inicio sin tocar la duración, el fin se mueve con ella
  en vez de quedar fijo en el pasado. Ese instante se recorta a "ahora
  mismo" si cae en el futuro (toma recién empezada, los minutos elegidos
  aún no han pasado) - la API rechaza cualquier `ended_at` futuro, y
  obligar a esperar a que la toma termine de verdad para poder guardar
  la duración no parecía buena idea. Se manda siempre explícito (`null`
  cuando no aplica, nunca omitido del payload): omitir la clave del todo
  al editar dejaba una duración ya guardada sin tocar en la fila
  (`$feedModel->update()` solo pisa las columnas presentes en el array
  validado), así que poner "Sin indicar" en una toma con duración previa
  no la borraba. Biberón y sólido no llevan duración - `ended_at` en la
  API ahora lleva `prohibited_unless:type,pecho` (ver `api/README.md`).
  El avatar en
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
  cronómetro. Botón "Eliminar todas las contracciones" (mismo patrón de
  confirmación en dos pasos que "Dejar de cuidar al bebé") que llama a
  `babies.deleteAllContractions()` — útil tras una falsa alarma, sin
  tener que borrar fila por fila. Vivió primero en los ajustes del bebé
  (`DashboardView.vue`, junto a "Dejar de cuidar"), siempre visible
  aunque no hubiera ninguna contracción que borrar; se movió al final
  de la propia `ContractionsView.vue` — la página que de hecho sabe si
  hay contracciones cargadas — y ahora solo aparece cuando las hay. El
  PDF exportado se ordenó de más
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
- **Sexo al crear el bebé, eliminar bebé para el cuidador único**
  (`DashboardView.vue`) — el formulario de onboarding ("Empieza con tu
  bebé") solo pedía nombre y fecha prevista de parto; el sexo (opcional,
  ya aceptado por el backend desde antes) quedaba relegado a fijarse
  después desde "Sexo / fecha de nacimiento". Ahora el mismo
  `SegmentedControl` de esos ajustes aparece también al crear el primer
  bebé y al añadir uno adicional. Por otro lado, "Dejar de cuidar al
  bebé" ya rechazaba salir como único cuidador (dejaría el bebé sin
  nadie vinculado — ver `api/README.md`), pero no ofrecía alternativa:
  la única salida real era compartir antes el código de invitación con
  alguien más. Cuando ese intento falla, la propia hoja de ajustes
  muestra ahora "Eliminar este bebé" justo debajo del error —
  `babies.remove()` → `DELETE /babies/{baby}`, mismo patrón de
  "detectar el 422 concreto y ofrecer la salida real" que ya usa
  `leaveError`.
- **Tipo de leche en tomas de pecho, color de las heces en pañales
  sucios** (`DashboardView.vue`) — al elegir "Pecho" en el formulario de
  "+ Toma" aparece un segundo `SegmentedControl` ("Calostro"/"Leche",
  con "Leche" preseleccionada por defecto, mismo sitio que ya ocupaba el
  selector de lado). El formulario de "+ Pañal" gana un selector de
  color (Verde/Amarillo/Marrón/Meconio) que solo se muestra con
  "Sucio"/"Ambos" — un pañal solo mojado no tiene heces que describir, y
  el backend lo rechaza si se manda ahí (ver `api/README.md`). No es un
  `SegmentedControl` de texto como el resto de selectores de la app:
  cada opción es un círculo con el color real (tonos apagados, no CSS
  named colors — el meconio, deliberadamente casi negro en vez de un
  "negro" plano, es el motivo real del cambio: un cuidador reconoce un
  pañal por su color, no leyendo la palabra "Marrón"), con una marca de
  verificación blanca sobre la opción elegida (`ring-2 ring-brand
  ring-offset-2`, mismo patrón ya usado en `WeeklySleep.vue` para
  marcar "hoy"). "Sin indicar" es la excepción y sigue siendo un botón
  de texto — no representa ningún color, forzarlo a un círculo gris no
  comunicaría nada. Ambos campos (tipo de leche y color) viajan como
  `undefined`/`null` fuera de su contexto (toma no-pecho, pañal mojado)
  para no depender de que el backend ignore un valor que no debería
  haberse mandado.

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
El español es la fuente de verdad al tocar copy: un cambio de texto se
hace primero ahí y el inglés se ajusta para seguirlo, no al revés.
Comprobación estructural rápida de que ambos ficheros tienen las mismas
claves (útil tras un cambio grande, no algo que haga falta correr
siempre) — un script de Node de una vez, sin dependencia nueva:
convierte cada `export default` a `module.exports` al vuelo, hace
`require()` del resultado y compara las claves aplanadas de los dos
objetos.

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

## Predicciones

Las tarjetas de próxima toma/próximo sueño (`feedPredictionLabel`/
`sleepPredictionLabel` en `DashboardView.vue`) vivían en un recuadro
destacado con su propio icono grande, al final del dashboard, después
de la línea temporal. Se movieron justo debajo de las estadísticas de
hoy — es la pregunta que de verdad se mira primero al abrir la app —
y pasaron a usar `EntryCard`, el mismo componente que cada fila de la
línea temporal, para que se lean como un evento más en vez de un
bloque visual aparte. Solo se muestran en "hoy" (`isRhythmToday`, ver
la nota de "Línea temporal" más arriba); en un día pasado no tiene
sentido estimar algo relativo a "ahora". `EntryCard` trae de fábrica
elevación al hover, icono que escala y un `<button>` con `@click` -
pero no hay nada real detrás de una predicción que abrir, así que
invitaban a un toque que no hacía nada. Nuevo prop `interactive`
(`false` para estas dos, `true` por defecto en el resto): en `false`
el contenido se envuelve en un `<div>` en vez de un `<button>`, sin
`card-interactive` ni el grupo que dispara el hover del icono - mismo
layout exacto, sin la promesa visual de que algo va a pasar al
tocarlo.

Nuevo interruptor "Predicciones" en "Tu cuenta" (`AccountSheet.vue`,
junto a la barra de accesos, mismo patrón de guardado al vuelo con
reversión si el `PUT` falla) que activa/desactiva
`auth.user.predictions_enabled` (`auth.updatePredictionsEnabled()` →
`PUT /user/predictions`, ver `api/README.md`) — por si alguien
prefiere no ver estimaciones, solo lo registrado. Activadas por
defecto.

Mismo patrón exacto para el interruptor "Tarjetas resumen del día"
(`auth.user.today_summary_enabled`, `PUT /user/today-summary`) que
muestra/oculta `TodaySummary.vue` (tomas/sueño/pañales bajo la tarjeta
del bebé) — activado por defecto, `v-if` directo en la propia etiqueta
`<TodaySummary>` en `DashboardView.vue`, sin tocar el componente.

## Sonidos para dormir

Nueva sección (`SoundsView.vue`, ruta `/sonidos`): elegir un sonido de
una rejilla de 6 categorías (ruido blanco, tormenta, latido, grillos,
olas, ventilador) y reproducirlo con un temporizador (15/30/45/60 min o
sin límite), con un fundido de entrada fijo (1.5s, independiente de la
duración elegida) al arrancar y un fundido de salida que sí escala con
ella, en el último 10% del tiempo, en vez de un corte en seco en
ninguno de los dos extremos. Cambiar la duración mientras ya suena el
fundido de salida (con el selector de duración) deshace ese fundido en
vez de dejarlo silenciado para siempre con la cuenta atrás ya
reiniciada — para el ruido blanco cancela la automatización de
`GainNode` ya agendada (una rampa de Web Audio programada en un
instante *absoluto* que no se cancela sola), para los ficheros
`<audio>` restaura `volume = 1`; encontrado en una revisión de
fiabilidad tras varias iteraciones seguidas sobre `useSoundPlayer.ts`.
Validado primero con un borrador interactivo
(artifact HTML con los tokens reales de la app) antes de tocar código
real. La entrada al Dashboard (`SoundsLinkCard.vue`) va junto a la de
Contracciones, salvo cuando "Tarjetas resumen del día" (ver más abajo)
está activo y el bebé ya ha nacido: ahí baja justo debajo de
`TodaySummary`, para no interponerse entre la tarjeta del bebé y las
tomas/sueño/pañales de hoy.

Cada categoría tiene su propio color de icono (`soundText`/`soundBg`
en `lib/soundCategory.ts`, tokens `--sound-*` en `base.css` con
variante clara/oscura — mismo patrón que `categoryText`/`categoryBg`
de `lib/category.ts` para tomas/sueño/pañales) en vez de compartir el
`bg-brand-teal` genérico, para distinguirlas de un vistazo en la
rejilla de 6. La animación de "reproduciendo" (un anillo respirando,
`.timer-ring`, en `currentColor` para heredar el color de cada
categoría) vive directamente en el badge del icono de la tarjeta que
está sonando en la rejilla, no en un círculo aparte duplicado en el
panel inferior — ese panel solo lleva el selector de duración, el
texto de estado ("Reproducir Grillos", "Quedan 04:12"…, con el nombre
de la categoría integrado en el propio texto) y el botón de play/stop.

**"Ruido blanco" no usa ningún fichero de audio** — se genera en el
momento con la Web Audio API (`AudioContext` + un buffer de ruido
relleno con `Math.random()` + un `GainNode` para el fundido y los
fundidos de entrada/salida), así que esa categoría concreta nunca va a
depender de un asset con licencia. Al generarse a escala digital
completa (RMS de ~-4.8dBFS) sonaba notablemente más fuerte que los
ficheros mp3 reales (que rondan -22.5dB de media) incluso al mínimo de
volumen del dispositivo — el propio `GainNode` lleva una ganancia fija
de 0.13, calculada para igualar su RMS al de las otras categorías, en
vez de sonar a escala completa.
Las otras 5 sí reproducen un `<audio loop>` apuntando a
`public/sounds/<categoría>.mp3`. **Las 6 categorías tienen ya audio
real** (recortados a ~15 min desde las grabaciones originales de
~20min-1h que pasó Odei — el `<audio loop>` del navegador repite el
fichero las veces que haga falta para cubrir la duración elegida en el
temporizador, así que 15 min de textura continua sin melodía cubre de
sobra hasta "Sin límite" sin que se note la repetición, a cambio de
~85 MB en vez de varios cientos en el repo). Preparados con un
*crossfade* real de unos segundos entre el final y el propio principio
del clip (filtro `acrossfade` de `ffmpeg`, no un recorte a tijeretazo)
para que el punto donde empalma el bucle consigo mismo no suene como
un salto brusco — el tipo de sonido continuo (agua, lluvia, latido,
grillos, ventilador) lo permite sin que se note. Si en el futuro algún
fichero llegase a faltar, el propio evento `error` del `<audio>`
marca esa categoría como "Audio pendiente" en su tarjeta
(deshabilitando solo el botón de reproducir, no toda la tarjeta) en
vez de dejarla "reproduciendo" para siempre sin sonido real.

El estado (categoría activa, cuenta atrás, si está sonando, qué
categorías están marcadas como no disponibles) vive en
`useSoundPlayer.ts` (`src/composables/`, primer fichero de esa carpeta
en este repo) como un **singleton a nivel de módulo** — los refs se
declaran fuera de la función exportada, así que todo importador
comparte la misma instancia — mismo criterio que `useTheme.ts` de
LudoDex. Es deliberado: el sonido tiene que seguir sonando si el
usuario navega fuera de `/sonidos` (todo el sentido de la función es
"sonar mientras el bebé se duerme", no "solo mientras esta pantalla
está abierta"), así que no puede vivir en el estado local de la vista.
`SoundsView.vue` solo guarda localmente qué tarjeta está *seleccionada*
(qué se ve en el reproductor); tocar una categoría distinta llama a
`stop()` si algo estaba sonando, para que cambiar de sonido sea un
corte limpio. Un doble click/doble toque rápido sobre la misma tarjeta
(detectado a mano por diferencia de tiempo entre clicks, 400ms, no con
el `dblclick` nativo — más fiable en móvil que desactiva el zoom por
doble toque) reproduce esa categoría directamente, o la para si ya
estaba sonando, sin pasar por el botón de play del panel inferior.

Última categoría/duración elegida persistida en `localStorage`
(`pequedex_sound_last`, mismo patrón de getter/setter con guardas que
`theme.ts`), para preseleccionarlas la próxima vez sin arrancar el
audio automáticamente. Wireado también un `navigator.mediaSession`
básico (metadata + controles de play/pause en la pantalla de bloqueo)
como mejor esfuerzo, envuelto en `try/catch` — un PWA puede seguir
siendo suspendido en segundo plano por el sistema operativo pese a
esto, no es una garantía, y la propia API puede no existir en todos los
entornos. El título de esa metadata se traduce con `i18n.global.t`
(no el `t()` de un componente, porque `useSoundPlayer.ts` no lo es) a
partir del `labelKey` de `SOUND_CATEGORIES` y se capitaliza la primera
letra — usar el id interno tal cual (`category.value`, ej. `"waves"`)
dejaba la notificación en inglés y sin traducir en Android aunque el
resto de la app estuviera en español.

Tests en `useSoundPlayer.spec.ts` con `AudioContext`/`HTMLMediaElement`
mockeados a mano (ninguno de los dos existe en jsdom) y
`vi.useFakeTimers()` para la cuenta atrás: parada automática en 0,
fundido real en las dos rutas de audio (ramp de ganancia para ruido
blanco, `volume` decreciente para `<audio>`), cambio de categoría a
media reproducción detiene la anterior antes de arrancar la siguiente,
un fallo de reproducción marca "no disponible" sin dejar `playing=true`,
"sin límite" nunca dispara fundido ni parada automática, y la
persistencia sobrevive a un reimport fresco del módulo
(`vi.resetModules()`). Deliberadamente sin un `SoundsView.spec.ts` —
sería el primer test de vista del repo (solo hay tests de componentes y
stores hasta ahora), sin patrón previo de montaje con router + i18n +
un composable-singleton, y su cobertura real más allá del composable ya
testeado y de `SegmentedControl`/el icono (triviales) sería solo de
marcado/cableado.

## Sonido y vibración al interactuar

Interruptor "Sonido y vibración al interactuar" en "Tu cuenta" (cuarta
copia exacta del patrón de Predicciones/Borrar con swipe/Tarjetas
resumen: `auth.user.interaction_feedback_enabled`,
`PUT /user/interaction-feedback`, activado por defecto). Composable
nuevo `useFeedback.ts` (`src/composables/`) — sin estado de singleton,
solo funciones (`tap`/`success`/`error`/`cancel`/`select`/`nav`/
`navBack`/`theme`/`tick`/`warnVibrate`) que comprueban ese ajuste en
cada llamada, no en un valor cacheado, para que activarlo/desactivarlo
tenga efecto inmediato sin recargar la página:

- **Sonido**: tonos cortos sintetizados con Web Audio sobre un único
  `AudioContext` reutilizado entre llamadas — sin ningún fichero de
  audio, mismo criterio que el ruido blanco de Sonidos para dormir.
  Cada tipo tiene su propio timbre, no un genérico reutilizado: `tap`
  un blip discreto, `success` dos notas ascendentes, `error` un tono
  grave con doble pulso, `cancel` un barrido descendente (`playSweep`,
  frecuencia deslizante en vez de fija — un "paso atrás"), `select`
  dos blips muy cortos y agudos (el tic-tic de un selector), `nav` un
  arpegio de 3 notas ascendentes (494/587/740Hz — un primer intento
  con `playSweep`, de barrido continuo, sonaba más a silbido que a
  confirmación), `navBack` las mismas 3 notas tocadas al revés y algo
  más juntas (un repliegue rápido, no una entrada espejada a cámara
  lenta), `theme` dos notas superpuestas algo más largas, `tick` un
  único blip muy corto (35ms) y discreto pensado para repetirse varias
  veces seguidas sin solaparse ni sonar a ruido continuo — el clic de
  un dial físico, no una confirmación puntual. `warnVibrate` no suena
  — solo vibra.
- **Vibración**: `navigator.vibrate()` con feature-detect y
  `try/catch`, un patrón distinto por tipo (`8`ms `tap`, `10`ms
  `success`, `[12, 40, 12]` `error` — estos dos últimos son los que ya
  usaba `toast.ts` en un `hapticBuzz()` local antes de este cambio,
  ahora centralizados aquí — `6`ms `cancel`/`warnVibrate`,
  `[5, 18, 5]` `select`, `14`ms `nav`, `10`ms `navBack`, `16`ms
  `theme`, `3`ms `tick`). **No existe en PC ni en iOS Safari** — Apple
  nunca ha implementado la Vibration API ahí y no tiene planes
  anunciados de hacerlo; en esas plataformas el ajuste solo controla
  el sonido.

En vez de instrumentar cada botón de la app uno a uno, se engancha en
los puntos de interacción que ya existían en el código:

- **`directives/press.ts`** (`v-press`, ya aplicada a ~20 botones
  primarios/submit de Dashboard/Contracciones/AccountSheet/auth/
  onboarding para el efecto visual "pulsado"): `feedback.tap()` en el
  mismo `pointerdown` que añade la clase `.is-pressed` — cubre todos
  esos botones sin tocarlos uno por uno, incluido el start/stop de
  Contracciones.
- **`ActionBar.vue`**: `tap()` en `onTap()`, junto al ripple que ya
  dibuja al cambiar de categoría.
- **`DeleteButton.vue`**: `tap()` en `onClick()`, junto al shake de
  confirmación.
- **`SoundsView.vue`**: `tap()` al pulsar play/stop y en la rama de
  doble-tap que arranca/para un sonido.
- **`DailyRhythm.vue`**: `tap()` en `onPrev()`/`onNext()`, las flechas de
  navegación por día del "Ritmo".
- **`stores/toast.ts`**: su `hapticBuzz()` local se sustituye por
  `useFeedback().success()`/`.error()` según el tipo de toast — mismo
  momento (dentro de `show()`), ahora sí gateado por el ajuste en vez
  de vibrar siempre incondicionalmente.
- **`SegmentedControl.vue`**: `select()` al cambiar de valor (no al
  re-tocar la opción ya activa) — un único fichero cubre idioma,
  duración de Sonidos, tipo de toma, sexo del bebé y cualquier otro
  selector de ese tipo.
- **Selectores de tipo/color que no usan `SegmentedControl.vue`**
  (`DashboardView.vue` — llevan icono o swatch de color propio por
  opción, no solo texto, que ese componente no admite): tipo de leche
  (`onSelectFeedMilkType()`), tipo de pañal (`onSelectDiaperType()`) y
  color de las heces (`onSelectDiaperResidueColor()`) disparan `select()`
  con el mismo criterio — nada al re-tocar la opción ya activa.
  `selectMilestoneCategory()` suena siempre, sin esa comprobación — ahí
  tocar la ya activa sí es un cambio real (la deselecciona).
- **`ThemeToggle.vue`**: `theme()` en `toggle()`.
- **`WheelColumn.vue`** (selector tipo rueda, día/mes/año en el
  asistente de "Añadir bebé"; día/hora/minuto en `DateTimeWheel.vue`,
  ver más abajo): `tick()` en `onScroll()` cada vez que la fila más
  cercana al centro cambia mientras el usuario aún sigue deslizando —
  independiente del `update:modelValue` que emite por separado, solo al
  asentarse el scroll. La misma fila (`liveIndex`, actualizada en tiempo
  real, no solo al asentarse) lleva además su propio indicador visual —
  texto en negrita y color de marca, no solo la banda de fondo fija —
  para que una rueda de solo dígitos (hora/minuto) deje tan claro qué
  valor está elegido como ya dejaba una de etiquetas con texto propio
  ("Hoy"/"Ayer").
- **Botones "Cancelar"**: `cancel()` — `cancelSheet()` nuevo en
  `DashboardView.vue` (envoltura de `closeSheet()` solo para el click
  del botón, ya que `closeSheet()` en sí también se llama tras un
  guardado con éxito), y la rama "no confirmado" de los diálogos de
  confirmación en `ContractionsView.vue`.
- **Entradas/salidas de una sección propia**: `nav()` en los enlaces a
  Contracciones (`DashboardView.vue`) y Sonidos para dormir
  (`SoundsLinkCard.vue`); `navBack()` en el botón de volver de esas
  dos mismas vistas (`ContractionsView.vue`/`SoundsView.vue`).
- **`onSwitchBaby()`** (`DashboardView.vue`, pastillas de bebé del
  Dashboard): `select()` al cambiar de bebé - el propio guard contra
  re-tocar el ya activo (`if (id === babies.current?.id) return`) ya
  descarta el caso de "sin cambio real", así que suena siempre que
  llega a ejecutarse, sin repetir esa comprobación.
- **`toggleActionBarCategory()`** (`AccountSheet.vue`, accesos de la
  barra principal): `tap()`, mismo criterio guardado-al-vuelo que
  predicciones/borrar con swipe/tarjetas resumen/sonido al interactuar
  en ese mismo fichero.
- **`AppHeader.vue`**: `onOpenAccountSheet()` (`tap()` + abrir la hoja
  de "Tu cuenta") en el botón del avatar - no importaba `useFeedback`
  hasta ahora, era el único botón del header sin ningún sonido propio
  (`ThemeToggle.vue` ya suena solo).
- **`EntryCard.vue`**: `warnVibrate()` como preaviso a mitad del gesto
  de swipe-to-delete — el swipe aquí es scroll nativo con
  `scroll-snap` (no un drag a mano), así que el enganche es un
  listener de `scroll` que dispara un único pulso cuando el
  `scrollLeft` cruza el 50% del ancho revelado, rearmado en cuanto el
  panel vuelve a cerrarse.

Tests en `useFeedback.spec.ts` (gating on/off, ausencia de
`navigator.vibrate`/`AudioContext` sin lanzar excepción, reuso del
mismo `AudioContext` entre llamadas) y 3 añadidos a `toast.spec.ts`
para el nuevo gating.

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
  bajo `@media (prefers-reduced-motion: reduce)`. Ronda posterior,
  explorada antes en un boceto interactivo con tres propuestas de
  botón eliminar comparadas en contexto: `DeleteButton.vue` separa la
  tapa del icono de cubo (el trazo del borde superior + asa) del resto
  del trazo en un `<path>` propio, con `transform-origin` en la
  esquina donde se abre - gira al hover como aviso pasivo antes de
  pulsar, con squish al hacerlo; el cierre de la fila en sí sigue
  siendo la misma transición `entry-list-leave` de siempre, sin tocar.
  `.btn-primary` gana un brillo diagonal de un solo barrido al hover
  (`::after` con gradiente, `translateX` de fuera a fuera). Los
  accesos de `ActionBar.vue` (sin ningún feedback propio hasta ahora,
  más allá del color del texto) inclinan su icono y suben el círculo
  ligeramente al pasar el ratón, vía clases `group-hover`/`motion-reduce`
  de Tailwind en vez de CSS aparte.
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
  verdad se usa de noche para las tomas. El propio cambio de tema lleva
  un barrido circular que crece desde el botón (View Transitions API +
  Web Animations API, con caída a cambio instantáneo si el navegador no
  la soporta o hay `prefers-reduced-motion`) — ver el docblock de
  `toggle()` en `ThemeToggle.vue` y las reglas `::view-transition-*` al
  final de `base.css`.
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
  de color por categoría. El `badge` del componente (existía ya, sin
  usuario ninguno) ahora sí tiene uno: `entryDuration()` en
  `DashboardView.vue` rellena el hueco a la derecha del título/hora en
  las entradas de sueño y en las tomas al pecho con duración indicada,
  con su duración ("2h 15min") calculada desde `started_at`/`ended_at`
  (sueño: hasta ahora mismo si sigue en curso, sin `ended_at`; toma: nada
  si no se indicó duración, no hay concepto de "en curso" para una toma)
  - antes solo se veía la hora de inicio. El propio badge lleva ancho
  mínimo y texto centrado, no solo `whitespace-nowrap` - sin esto,
  "15min" y "2h 15min" generaban píldoras de anchos muy distintos, que
  no se leían alineadas entre sí fila a fila. Las clases de Tailwind por
  categoría (`text-feed`, `bg-feed/15`, …) están en `category.ts` como
  tablas de
  búsqueda literales, no interpoladas (`` `text-${category}` ``): el
  escáner de Tailwind solo detecta nombres de clase que aparecen tal
  cual en el código fuente. Los iconos de `CategoryIcon.vue` (toma,
  sueño, pañal, hito) se rediseñaron tras comparar dos bocetos con
  Odei: biberón de trazo grueso con la línea de nivel de leche, luna
  llena rellena con dos destellos, funda de pañal redondeada con el
  pliegue lateral, y la estrella de hito redibujada con las puntas más
  largas (una estrella de 5 puntas lee más pequeña que un círculo del
  mismo tamaño de caja por sus huecos cóncavos, así que escalar solo
  el chip que la contiene no bastaba). Ajuste posterior encontrado en
  vivo: el pañal con `rx=6` sobre un rectángulo de 13 de alto se leía
  casi como un círculo al tamaño real de la app (19-22px, no los
  48-56px del boceto de muestra) — `rx=4` para que se note que es una
  funda, no un óvalo. Crecimiento se queda con el icono de siempre; de
  varias alternativas exploradas (regla, báscula, barras) ninguna lo
  mejoraba.
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
  El día que la cuenta atrás llega a 0, el titular numérico se
  sustituye por el texto especial `t('dashboard.hero.countdownToday')`
  ("¡Puede ser hoy!") — reportado en vivo a ~355-360px de ancho real
  (pantallazo de móvil): esa frase, más larga que un simple número +
  unidad, compartía fila con `heroDateLabel` (que sigue mostrando
  "Fecha prevista: ..." aunque sea justo hoy) vía `justify-between`
  sin envolver, así que se veía forzada a partirse en tres líneas
  dentro del hueco estrecho que quedaba. Bajar el tamaño de letra no lo
  arreglaba (la fecha en `whitespace-nowrap` seguía comiéndose casi
  todo el ancho); el fix real fue añadir `flex-wrap` a esa fila —
  cuando el titular y la fecha no caben en la misma línea, la fecha
  entera baja como bloque a una segunda línea en vez de partir palabras
  del titular en una tercera. No cambia nada en el caso numérico
  normal ("12 días" + fecha), que ya cabía de sobra en una sola línea.
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
  manda al backend tiene que estarlo también. Bug real encontrado en
  vivo: las marcas de toma/pañal (barras de 5px) posicionaban su borde
  izquierdo en el `left: X%` exacto en vez de su centro, así que se
  veían desplazadas unos píxeles a la derecha de la hora real —
  corregido con `-translate-x-1/2`; los segmentos de sueño no lo
  necesitan, su ancho ya representa la duración real. Seguía
  reportándose el mismo desajuste tras ese arreglo: la propia escala
  ("0h/6h/12h/18h/24h" bajo la gráfica) usaba `flex justify-between`
  sobre texto de ancho desigual, que reparte espacio por hueco entre
  cajas de texto en vez de por posición porcentual, así que
  "6h"/"12h"/"18h" no caían en su 25%/50%/75% real - verificado en el
  DOM tras el arreglo (`getBoundingClientRect()` de cada etiqueta
  contra la barra). Pasan a posicionarse por el mismo porcentaje
  absoluto que las marcas: 0h/24h ancladas a los bordes del contenedor
  (son los límites del día, no puntos a centrar), 6h/12h/18h centradas
  con `-translate-x-1/2` igual que las marcas. "Línea temporal"
  (`DashboardView.vue`) reutiliza ahora ese mismo `rhythmDate`/
  `rhythmTimeline` en vez de leer `babies.timeline` directamente: gana
  los mismos separadores de día (nuevo computed `groupedTimeline`) y
  queda filtrada al día navegado, en vez de tener su propio selector
  duplicado. Las tarjetas de predicción de próxima toma/próximo sueño
  se ocultan mientras no se está en "hoy" (`v-if="... && isRhythmToday"`),
  ya que estiman algo relativo a "ahora", no a un día ya cerrado. Bug
  real reproducido en producción, no solo local: al navegar a un día
  pasado, "Línea temporal" mostraba también entradas de la madrugada
  del día siguiente. `babies.dayTimeline` es deliberadamente más ancho
  que el día exacto (empieza un día antes para no cortar un sueño que
  cruza medianoche), calculado por el backend en límites UTC, no en la
  zona horaria del navegador — con una zona por delante de UTC (Europe
  /Madrid, UTC+1/+2) esa ventana se traduce a un tramo local que
  empieza antes y termina después del día pedido. `DailyRhythm.vue` ya
  recortaba esto por su cuenta para las barras (`[start, end)` en hora
  local); "Línea temporal" renderizaba la respuesta del backend tal
  cual. Nuevo `visibleTimeline`: en un día pasado, filtra
  `rhythmTimeline` a los límites locales exactos del día antes de
  agrupar - mismo recorte que `DailyRhythm.vue`, aplicado también aquí.
  `TodaySummary.vue` (la fila de tarjetas tomas/sueño/pañales bajo la
  cabecera del bebé) reutiliza igual `rhythmDate`/`rhythmTimeline` —
  antes recalculaba siempre contra "ahora" internamente, así que
  navegar a un día anterior movía "Ritmo"/"Línea temporal" pero dejaba
  estas tarjetas ancladas al recuento de hoy. Recibe `day` como prop
  (mismo patrón que `DailyRhythm.vue`) y calcula su ventana
  `[00:00, 24:00)` contra ese día en vez de contra `new Date()`; el
  recorte de un sueño en curso sigue usando `now` como su `ended_at`
  implícito (no hay otro dato), pero ya no necesita distinguir
  hoy/no-hoy explícitamente: el propio recorte contra `[start, end]`
  del día lo deja dentro de sus límites igual en cualquier caso. Las
  etiquetas pierden la coletilla "hoy" ("tomas hoy" → "tomas") al dejar
  de ser cierta siempre. El orden de las secciones del dashboard también
  cambió: "Hitos" pasó a ir justo debajo de las tarjetas resumen, con la
  predicción de próxima toma/sueño ahora por debajo de "Hitos" en vez de
  por encima (mismo bloque `template v-if="isBorn"`, sin ningún cambio
  de lógica en las condiciones `v-if` de cada sección, solo su orden).
- **`EntryCard.vue`** cambia el borde de color fino por un lavado de
  fondo del color de categoría (`categoryBg`, ya existente) en toda la
  fila; el icono pasa a un chip semitransparente (`bg-surface/70`) para
  no perderse contra ese mismo fondo. `categoryBorder` se retira de
  `category.ts` al quedarse sin ningún uso. Nueva prop opcional
  `swatchColor` (más tarde retirada, ver el párrafo del icono de caca
  al final de esta misma entrada) — un círculo pequeño junto al título,
  usado por la fila de un pañal sucio con color indicado ("Pañal
  (Sucio) ●", vía nueva función `entryColorSwatch()` en
  `DashboardView.vue`); `undefined` en cualquier otro caso (pañal
  mojado, o color sin indicar) no renderiza nada, no un punto vacío.
  `lib/diaperResidueColor.ts` extrae el mapa color→hex que ya usaba el
  selector de "+ Pañal" a un módulo propio, compartido ahora por ambos
  sitios. Segunda prop opcional, `dropletColor` — un icono de gota
  (mismo `<path>` que ya usaba el
  botón de rotura de bolsa de aguas en `ContractionsView.vue`), no el
  círculo plano de `swatchColor`, porque está ilustrando un líquido: la
  fila de una toma de pecho la lleva siempre, dorada para calostro
  (color real) o blanca para leche (`lib/milkType.ts`, mismo patrón que
  el mapa de pañales) - a diferencia del punto de pañal, aquí no hay
  "sin indicar" que ocultar, el tipo de leche es obligatorio en una
  toma de pecho. La gota blanca lleva contorno propio
  (`stroke="currentColor"` con `text-text-muted`, el relleno real solo
  en `fill`) para seguir siendo visible sobre el fondo claro de la
  propia fila - un relleno blanco puro sin contorno se perdía contra
  `bg-feed/15` en tema claro. Ampliado tras un reporte en vivo: solo
  cubría el pecho, dejando el biberón y cualquier toma de pecho
  registrada antes de que `milk_type` existiera (esas filas tienen
  `null` para siempre, nada las rellena solo) sin gota - un hueco que
  se leía como inconsistente en una línea temporal real con historial
  mixto. `entryMilkDroplet()` da a un biberón la misma gota blanca que
  "Leche" directamente (no tiene el campo, pero sigue siendo leche -
  fórmula o extraída, ambas blancas) y a una toma de pecho con
  `milk_type: null` el mismo blanco por defecto, igual que ya asume el
  propio formulario "+ Toma" al crear una nueva. Solo una toma sólida
  se queda sin gota, al no ser leche en absoluto. El propio selector de
  "Calostro"/"Leche" en "+ Toma" ganó luego la misma gota, no solo el
  texto: deja de ser un `SegmentedControl` genérico (texto plano) y
  pasa a un control a medida con la gota + etiqueta por botón (mismo
  `<path>`/colores que la de la línea temporal, vía
  `feedMilkTypeOptions`), para que el cuidador ya sepa qué aspecto va a
  tener antes de guardar. El propio selector de tipo de pañal
  (Mojado/Sucio/Ambos) ganó el mismo tratamiento: deja de ser un
  `SegmentedControl` de texto y pasa a tres botones a medida con
  iconos - una gota amarilla de pipi fija (`DIAPER_PEE_COLOR`, nuevo en
  `lib/diaperResidueColor.ts`) para "Mojado", un icono de caca teñido
  con `diaperPoopIconColor` (el color de heces ya elegido debajo, o
  marrón mientras no se haya elegido ninguno) para "Sucio", y los dos a
  la vez sin texto para "Ambos" (con `aria-label` propio, ya que el
  texto se retira ahí). Esto reemplazó por completo el punto plano de
  `swatchColor` en `EntryCard.vue`: la prop se retira y en su lugar
  llega `poopColor`, un icono nuevo - un remolino de cuatro círculos
  apilados de radio decreciente, no un `<path>` dibujado a mano (según
  la propia guía de diagramado del proyecto, una forma decorativa
  compleja pide simplificarse a primitivas) ni el emoji 💩 literal (no
  se puede teñir de un color arbitrario de forma fiable entre
  navegadores). `entryPeeDroplet()`/`entryPoopColor()` en
  `DashboardView.vue` calculan qué icono(s) lleva cada fila de pañal en
  la línea temporal, mismo criterio que el propio formulario: gota para
  mojado/ambos, caca (con el mismo *fallback* a marrón) para
  sucio/ambos. Tercera prop opcional, `emoji` (más `emojiPulsing`) -
  genérica, no específica de sueño, a diferencia de `dropletColor`/
  `poopColor`: aquí sí es literalmente el emoji 💤 (`entrySleepEmoji()`
  en `DashboardView.vue`), porque no hay ningún color que comunicar,
  mismo criterio que ya usa `lib/milestoneCategory.ts` para los hitos -
  "emoji, no un set de iconos". `emojiPulsing` (una animación de
  opacidad + `translateY` suave, `prefers-reduced-motion` respetado)
  distingue un sueño en curso (`ended_at` aún `null`) de uno ya
  terminado sin cambiar el propio emoji.
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

La "suela" de la marca (el óvalo grande) era hasta ahora una elipse
lisa (`<ellipse>`). Sustituida por un `<path>` que conserva la misma
curvatura en la parte de arriba pero cierra en un remate más estrecho
y redondeado en el borde inferior, sugiriendo un tobillo en vez de
terminar en el punto natural de la elipse — encontrada a base de
varias vueltas: un primer intento con una cintura simétrica a la
altura del corazón se leía como una calavera (cuencas de ojos), y un
segundo intento con estrechamiento continuo desde arriba se leía como
un cono de helado. La forma final mantiene el óvalo pleno del
original en los dos tercios de arriba y solo curva hacia dentro en el
tercio inferior. El mismo `<path>` vive en tres sitios que dibujan la
marca por separado y hay que mantener sincronizados a mano —
`AppMark.vue`, `favicon.svg` y el logo del PDF de exportación de
contracciones (`ContractionsExportController.php`, que no puede
referenciar el SVG de `web/` porque genera el documento en el
backend) — no hay un origen único del que se generen los otros tres.

Los iconos PNG derivados (`favicon-32.png`, `favicon.ico`,
`apple-touch-icon.png`, `icons/icon-192.png`, `icons/icon-512.png`,
`icons/icon-maskable-512.png`) no se regeneran con ninguna herramienta
del proyecto — no hay `sharp`/`svgexport` ni Inkscape/ImageMagick entre
las dependencias — se renderizaron a mano con Edge en modo headless
(`--screenshot`) contra una página que reproduce el mismo SVG a
tamaño/padding/fondo variables por icono. `--window-size=32,32` colgó
el proceso de forma reproducible (el renderer nunca llega a escribir
el PNG ni el proceso sale solo) mientras que 16/180/192/512 sí
funcionaron sin problema — se esquivó renderizando a 256px y
reescalando a 32/16px con `System.Drawing` desde PowerShell, y
montando `favicon.ico` a mano en Node (cabecera ICO estándar con las
dos imágenes PNG embebidas tal cual, formato que tanto Windows como
los navegadores aceptan).

## Barra de estado en la app instalada

Reportado en vivo: al abrir la app ya instalada como PWA en Android, la
barra de estado (el borde superior, encima de `AppHeader.vue`) se veía
de un color distinto al fondo real de la cabecera — costura visible en
vez de una sola superficie continua. Causa: `<meta name="theme-color">`
en `index.html` estaba fijo en el rosa de marca (`#a65a6b`, el color de
acento que usan los botones), mientras que la cabecera en sí usa
`--bg` (crema en claro, casi negro en oscuro) — Android pinta la barra
de estado de una PWA instalada con `theme-color`, no con el color de
fondo real de la página, así que el desajuste era constante en los dos
temas, no solo en uno.

`index.html` pasa de una única etiqueta fija a tres: una
`#theme-color-override` sin `media`, vacía de partida (un
`content=""` es inválido y el navegador la ignora, cayendo a la
siguiente que sí matchee) y dos más con `media="(prefers-color-scheme:
light/dark)"` reflejando `--bg` de cada tema — mismo patrón de "el
`data-theme` explícito gana, si no hay ninguno manda el sistema
operativo" que ya usa `base.css` para el resto de la paleta.
`theme.ts` → `applyTheme()` rellena esa etiqueta `#theme-color-override`
con el `--bg` del tema elegido a mano cuando el usuario toca
`ThemeToggle` (o la vacía de nuevo al volver a "según el sistema"), en
vez de depender solo de las dos etiquetas con `media` — esas no saben
nada de un `data-theme` explícito que contradiga la preferencia real
del sistema operativo. `manifest.webmanifest` también tenía su propio
`theme_color` fijo en el mismo rosa (usado por Android para la barra de
estado durante el splash de arranque, antes de que cargue ni CSS ni
JS) — pasa a `#fbf7f2`, igual que `background_color` (que ya usaba ese
mismo crema), así que la superficie es consistente también en ese
primer instante, sin esperar a que `theme.ts` corra.

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

## Transiciones entre rutas

`App.vue` envuelve `<RouterView>` en un único `<Transition name="route">`
global — deliberadamente **sin** `mode="out-in"`. Lo tuvo en su día (para
evitar que `DashboardView`/`ContractionsView` montaran dos veces sus
propios intervalos de sondeo en un cambio de ruta), pero `out-in` resultó
ser poco fiable en este Vue/navegador: una transición se queda colgada
para siempre bajo ciertas condiciones — el router ya tiene la ruta y el
componente resueltos, pero el DOM no pinta nada más, ni la página vieja
ni la nueva. Se encontró primero en transiciones que tocaban `welcome`
(arreglado en su momento con un bypass acotado solo a esa ruta) y
después, por separado, en Dashboard ↔ Contracciones — sin `welcome` de
por medio, confirmando que nunca fue un problema específico de una ruta
concreta. **No reintroducir `mode="out-in"` aquí** sin volver a probar a
fondo cada pareja de rutas del router con clicks reales (no solo con
`history.pushState`/eventos sintéticos en consola, que no siempre
reproducen el mismo fallo).

Viejo y nuevo se montan en su lugar en simultáneo (el modo por defecto
de Vue): `.route-leave-active` saca la página saliente del flujo
(`position: absolute`) y la hace desaparecer al instante, sin
transición, en cuanto deja de ser la ruta activa — evita la alternativa
peor de un fundido de salida que se solape visualmente con el fundido
de entrada de la página nueva (probado y descartado: se ve como un
parpadeo del contenido viejo). Cada intervalo de sondeo en
Dashboard/Contracciones ya tiene su propio `onUnmounted`, así que el
breve solape de montaje es inofensivo.

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
