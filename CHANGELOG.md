# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este
proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- **Exportar "Estadísticas" a PDF**, mismo flujo que ya existía en
  Contracciones: botón en la cabecera (`StatsView.vue`) que descarga
  `estadisticas.pdf` con los cuatro bloques (tomas, sueño, pañales,
  crecimiento). Igual que el resto de "Estadísticas", el cálculo
  (franjas horarias, medias por día) sigue siendo cosa del frontend -
  Laravel no puede saber la zona horaria real del cuidador -, así que
  el nuevo endpoint `POST /babies/{baby}/stats/export`
  (`StatsExportController`) no recalcula nada: solo valida la forma del
  payload ya calculado (`ExportStatsRequest`, con el mismo `present`
  en vez de `required` para los `points` de crecimiento que pueden
  venir vacíos) y lo pasa a una plantilla Blade
  (`resources/views/pdf/stats.blade.php`) con dompdf, mismo lenguaje
  visual que `pdf/contractions.blade.php`.
- **Interruptor "Hitos" en "Tu cuenta"** (`milestones_enabled`,
  séptima copia del patrón de Predicciones/Borrar con swipe/Tarjetas
  resumen/Sonido al interactuar/Sonidos/Estadísticas), lo más alto del
  perfil, justo debajo del selector de idioma. A diferencia de
  Sonidos/Estadísticas (una tarjeta de enlace aparte), "hito" ya era
  una de las 5 categorías de la barra de accesos personalizable, así
  que este interruptor actúa por encima de esa selección: con los
  hitos desactivados, tanto la sección del dashboard como su acceso
  rápido desaparecen sin importar lo que diga `action_bar_categories`,
  y el propio icono deja de ofrecerse en el selector de accesos.
- **Intervalos de sueño y de tomas, y tres estadísticas más no pedidas
  explícitamente** en "Estadísticas" (`lib/stats.ts`): tiempo despierto
  medio entre un sueño y el siguiente, y tiempo medio entre tomas -
  mismo cálculo y mismos umbrales de "ruido" que ya usan
  `SleepPatternPredictor.php`/`FeedPatternPredictor.php` en el backend
  (`MAX_WAKE_WINDOW_HOURS = 6`, `MAX_GAP_HOURS = 8`: un hueco más largo
  es casi siempre un tramo nocturno, no un patrón real, y falsearía la
  media), reimplementados en el frontend sobre el historial completo
  en vez de reutilizar los predictores (que miran solo las últimas 20
  entradas, pensados para "cuándo será la próxima", no para un
  resumen histórico). De propina, sobre los mismos datos ya cargados:
  tomas al día de media, cambios de pañal al día de media (ambos vía
  `averagePerDay()`, por día de calendario sobre el rango real que
  cubren los datos) - la pregunta natural una vez "cada cuánto" ya
  está en pantalla, sin ningún fetch adicional.
- **Sonidos para dormir y Estadísticas, visibles u ocultos desde "Tu
  cuenta"** (`api`: columnas `sounds_enabled`/`stats_enabled`
  booleanas, `default(true)`, dos rutas `PUT /user/sounds`/
  `PUT /user/stats`, quinta y sexta copia del mismo patrón
  guardado-al-vuelo que `interaction_feedback_enabled` y el resto de
  esta familia. `web`: dos interruptores nuevos en `AccountSheet.vue`,
  activados por defecto. Solo muestran/ocultan la tarjeta de enlace
  correspondiente en el dashboard (`SoundsLinkCard.vue`/
  `StatsLinkCard.vue`) - no bloquean la ruta en sí, `/sonidos` y
  `/estadisticas` siguen accesibles directamente si alguien ya tiene
  el enlace guardado, mismo alcance que ya tenía
  `today_summary_enabled` sobre `TodaySummary.vue`.

### Corregido

- **PDF de "Estadísticas": cabecera, franjas horarias y pie de página**.
  La cabecera cambia el texto suelto (nombre + "Generado el...") por
  una tarjeta con el mismo formato que la tarjeta principal del bebé en
  el dashboard: degradado de marca, nombre + sexo arriba, edad en
  grande (días mientras no cumple un mes, semanas después - mismo
  cálculo que `getBabyAge()` en `lib/babyAge.ts`, ahora también en PHP)
  y fecha de nacimiento debajo. Las franjas horarias (Madrugada/Mañana/
  Tarde/Noche) pasan de 4 filas a todo lo ancho con la cifra apretada al
  final a una rejilla de 2 por fila (`pdf/partials/bucket-grid.blade.php`,
  reutilizado por Tomas/Sueño/Pis/Caca), mismo estilo de ficha que ya
  usan los bloques de arriba. El pie de página (logo + "PequeDex ·
  Estadísticas" en cada página) ya seguía el mismo patrón que el de
  Contracciones - sin cambios ahí.
- **Marca de tiempo trasera de "Línea temporal" a dos líneas, ambas del
  mismo tamaño** en un sueño finalizado o una toma de pecho con
  duración cargada: arriba la hora en la que termina/finaliza, abajo la
  hora en la que empieza/inicia - antes solo mostraba la hora de
  inicio, y la primera versión de las dos líneas usaba un tamaño más
  pequeño para la de abajo.
- **Separador de día de "Línea temporal" con el nombre de la semana**:
  "6 de octubre de 2026" pasa a "Martes 6 de octubre". El selector de
  día de "Ritmo" (`DailyRhythm.vue`) gana el mismo formato - nuevo
  `formatWeekdayDateLabel()` en `lib/localDate.ts`, compartido entre
  ambos en vez de duplicar la misma lógica dos veces.
- **"Estadísticas" usaba un simple "Cargando" de texto** mientras el
  resto de la app ya usa la animación de la marca de PequeDex para su
  pantalla de carga (`DashboardView.vue`) - ahora usa la misma. El
  `<main>` también tenía un relleno inferior pensado para una barra
  fija al fondo (temporizador/barra de accesos) que esta página nunca
  ha tenido, dejando un hueco de sobra tras el bloque de Crecimiento.
- **"Ritmo" dejaba retroceder a días anteriores al nacimiento del
  bebé** (`DailyRhythm.vue`/`DashboardView.vue`): la flecha "anterior"
  no tenía ningún tope, igual que "siguiente" ya lo tiene en "hoy"
  (`isToday`). Nueva prop `isBirthDay` que desactiva "anterior" en
  cuanto `rhythmDate` llega a `birth_date` - mismo patrón
  `:disabled="..."` que la flecha opuesta, más el mismo guard en
  `onRhythmPrevDay()` por si acaso.
- **Editar o borrar una toma/sueño/pañal de un día anterior no se
  reflejaba en la línea temporal hasta cambiar de día en "Ritmo" y
  volver** (`stores/babies.ts`): la lista de un día pasado se pinta
  desde `dayTimeline` (una copia aparte, solo para ese día - separada
  de `timeline`, que es siempre "lo más reciente de hoy", para no pisarse
  con el sondeo cada 5s mientras el dashboard está abierto), pero
  `createFeed()`/`updateFeed()`/`deleteFeed()` y sus equivalentes de
  sueño/pañal solo tocaban `timeline`. Cambiar de día forzaba un
  `fetchDayTimeline()` nuevo, que sí traía el dato correcto del
  servidor - de ahí que "cambiar de día y volver" lo arreglara. Ahora
  las seis acciones actualizan ambas copias a la vez.
- **La rueda de "Inicio" se iba a la fecha de nacimiento del bebé al crear
  un sueño nuevo, en vez de a hoy** (`WheelColumn.vue`): confirmado en
  vivo contra el servidor local (dos intentos anteriores, centrados en
  la animación del scroll, no lo arreglaban de verdad). La causa real no
  tenía nada que ver con tiempos de animación: a diferencia de las
  ruedas de hora/minuto (24 y 60 filas fijas siempre), la de día
  (`dayOptions` en `DateTimeWheel.vue`) cambia de **tamaño** según el
  valor - de 1 sola fila inválida (el estado inicial, antes de abrir
  cualquier hoja, con `sleepStartedAt` todavía vacío) a los N días
  reales entre el nacimiento y hoy. El watcher que reposiciona la rueda
  corría con el flush por defecto de Vue (`'pre'`), que se dispara
  *antes* de que el DOM llegue a pintar esas filas nuevas - el
  `scrollTo()` se ejecutaba contra el `<div>` todavía con el contenido
  viejo (una sola fila, ~120px de alto), el navegador recortaba el
  scroll al máximo posible en ese instante, y nada lo reintentaba
  después de que el DOM creciera. El valor quedaba perfectamente
  correcto por dentro (`aria-selected` y el texto en rosa sobre "Hoy",
  confirmado inspeccionando el DOM en vivo) pero la posición visible de
  la rueda se quedaba clavada en la primera fila - el nacimiento. Ahora
  el watcher usa `flush: 'post'`, que espera a que el DOM ya refleje la
  lista de días en curso antes de intentar el scroll.

### Cambiado

- **El contador de edad del bebé muestra los días de uno en uno hasta
  que cumple un mes, no hasta las dos semanas** (`lib/babyAge.ts`):
  antes cambiaba a semanas en cuanto pasaban 13 días
  (`info.days < 14`); ahora compara contra la fecha real en la que el
  bebé cumple un mes - el mismo día del mes siguiente al nacimiento
  (`oneMonthAfter()`), no un proxy fijo de "30 días", para que un bebé
  nacido un 31 no cambie a semanas antes de tiempo según cuántos días
  tenga el mes de nacimiento. Nuevo campo `underOneMonth` en
  `BabyAgeInfo`, que sustituye al cálculo `info.days < 14` que vivía en
  `DashboardView.vue`.

### Añadido

- **Los bloques de "Estadísticas" respetan los accesos activados en el
  perfil, y van en el mismo orden que la barra de accesos** (tomas,
  sueño, pañal, medidas): un cuidador que desactivó sueño de la barra
  de accesos ya no ve ese bloque aquí tampoco, aunque haya sueños
  guardados de antes - mismo `enabledCategories` (`auth.user
  .action_bar_categories`, `null` = las 5 activas) que ya filtra la
  barra en `DashboardView.vue`, no un ajuste nuevo. El orden anterior
  (sueño, tomas, pañal, crecimiento) no seguía ningún criterio en
  particular.
- **Bloque de Crecimiento en "Estadísticas"**: peso/talla/perímetro
  craneal a lo largo del tiempo, cada uno con su propio gráfico de
  línea (`GrowthLineChart.vue`, SVG dibujado a mano - sin librería de
  gráficos, el proyecto no tenía ninguna y añadir una para un solo uso
  no compensaba), último valor + percentil (reutiliza los percentiles
  OMS que ya calculaba el backend por medición, `GrowthMeasurement`
  nunca necesitó cambios) y lo ganado desde el primer registro. A
  diferencia de sueño/tomas/pañales, sin umbral de "datos
  insuficientes": el crecimiento se mide pocas veces (un chequeo
  semanal/mensual, no varias veces al día), así que hasta una sola
  medición merece mostrarse - solo "lo ganado" necesita dos para
  existir. Los tres tipos de medida son independientes entre sí (se
  pueden registrar por separado); el bloque entero solo se oculta si
  no hay ninguna medición de ningún tipo todavía. El eje X del gráfico
  escala por fecha real, no por índice - dos mediciones con semanas de
  diferencia no quedan pegadas una a la otra como si hubiera pasado un
  día.
- **Nueva sección "Estadísticas" (`/estadisticas`), primera fase**:
  patrones de sueño (duración media, franja del día donde más duerme),
  tomas (reparto pecho/biberón, lado más usado, duración media al
  pecho, cantidad media en biberón, franja del día con más tomas) y
  pañales (reparto mojado/sucio/ambos, total por talla, franjas con más
  pis/caca por separado). Centralizado en el bebé actual únicamente, sin
  export a PDF todavía (queda para una fase posterior, una vez esta
  pantalla esté asentada).

  Todo el cálculo vive en el frontend (`lib/stats.ts`, funciones puras
  y testeadas sin tocar Pinia, mismo criterio que `lib/sleepHistory.ts`/
  `lib/contractionStats.ts`), no en un endpoint nuevo - ninguno de los
  endpoints `GET /babies/{id}/{sleeps,feeds,diaper-changes}` necesitó
  cambios, ya devolvían el historial completo sin filtrar (confirmado
  leyendo los controladores). Agregar por franja horaria en el backend
  habría requerido saber la zona horaria real de quien mira la app, que
  el servidor no conoce - exactamente el motivo por el que
  `WeeklySleep.vue`/`DailyRhythm.vue` ya calculan en el navegador en vez
  de en Laravel. `babies.fetchStatsData()` (nuevo) trae los tres
  historiales en paralelo a tres arrays dedicados (`statsSleeps`/
  `statsFeeds`/`statsDiaperChanges`), separados de `timeline`/
  `dayTimeline`/`recentSleeps` para no interferir con lo que ya leen.

  Cuatro franjas horarias fijas (Madrugada 00-06, Mañana 06-12, Tarde
  12-18, Noche 18-24), bucketing por la hora LOCAL de inicio de cada
  evento, no un reparto proporcional minuto a minuto como ya hace
  `summarizeSleepByDay()` por día - "a qué hora suele empezar" es la
  lectura más útil para "franja más habitual" sin esa complejidad
  extra. "Datos insuficientes" con menos de 3 entradas (mismo umbral
  `MIN_SAMPLE_SIZE` que `SleepPatternPredictor`/`FeedPatternPredictor`
  en el backend) en vez de una media o un reparto que dice más de lo
  que los datos sostienen.
- **La hora se adelanta junto al icono de tipo cuando aún no hay
  duración** (`EntryCard.vue`): mientras una toma espera a que se pulse
  su botón "Finalizar" (ver más abajo) - o en cualquier otra entrada
  sin duración pero con icono de tipo, como un pañal - la hora ya no
  vuela sola a la marca de tiempo de la derecha sin nada que la
  acompañe; vive en la segunda línea, delante del icono, igual que la
  duración lo haría si la hubiera. En cuanto hay duración (`badge`), la
  hora salta a su sitio habitual a la derecha y la segunda línea pasa a
  liderarla la propia duración - mismo comportamiento que ya había,
  sin cambios ahí. Como consecuencia directa, el 💤 de un sueño en
  curso vuelve a vivir junto a la hora (como ya hace la gota en una
  toma pendiente de "Finalizar"), no dentro del propio botón - se
  restaura la prop `emojiPulsing` de `EntryCard.vue` (la animación de
  "respirar" vuelve con ella) que se había retirado cuando el emoji se
  trasladó al botón por primera vez.
- **Botón "Finalizar" en la toma de pecho más reciente sin duración**
  (`DashboardView.vue`): a diferencia del sueño, `ended_at === null` en
  una toma no significa "en curso" - es su estado normal, opcional
  (nadie cronometra cada toma). Mostrar el botón en todas invitaría a
  pulsarlo sobre una de hace días, guardando una duración inventada con
  pinta de real; restringido a la última (`latestUnfinishedPechoFeedId`,
  buscada en `babies.timeline` - "lo más reciente de todo", no en la
  lista que se esté viendo, así que sigue identificando la misma toma
  aunque se navegue a otro día en "Ritmo"), el caso de uso encaja con
  la intención real: "se me olvidó indicar cuánto duró la que acabo de
  registrar". Al pulsarlo, calcula los minutos transcurridos desde
  `started_at` y los redondea hacia arriba a la franja existente más
  próxima (10/15/20/30/45) - nunca un minuto exacto, que nadie
  cronometró de verdad; recortado a "ahora mismo" si el redondeo se
  pasa de la hora real, igual que ya hacía `feedEndedAtIso()` en el
  formulario (la API rechaza cualquier `ended_at` futuro). La última
  franja del selector (en el formulario, en "Tu cuenta" y en la propia
  pastilla de la línea temporal) pasa de "45 min" a **"45+ min"** - más
  honesto sobre ser un cajón abierto, no una lectura exacta.
- **Talla "0" como opción de pañal y 15min como opción de duración de
  toma** - ambas se sumaron a la lista ya existente en cada sitio donde
  vivía (`DiaperSize` enum y `Rule::in()` del backend; `DIAPER_SIZES`/
  `feedDurationOptions` y sus copias en `AccountSheet.vue` para los
  valores por defecto) en vez de crear un camino nuevo, así que
  aparecen automáticamente en el formulario, en el badge de la línea
  temporal y en el selector de valores por defecto del perfil.
- **Talla de pañal y duración de toma por defecto, configurables en
  "Tu cuenta"** (`api`: columnas `default_diaper_size` nullable
  (`App\Enums\DiaperSize`) y `default_feed_duration_minutes` nullable
  en `users`, dos rutas `PUT /user/default-diaper-size` y
  `PUT /user/default-feed-duration`, mismo patrón guardado-al-vuelo que
  `interaction_feedback_enabled` y el resto de ajustes de esta familia
  - salvo que, al no ser booleanos, cada chip del grupo de radios manda
  directamente su propio valor en vez de invertir un estado. `web`: dos
  grupos de radios nuevos en `AccountSheet.vue`, mismas opciones que ya
  ofrecen los propios formularios ("Sin indicar"/1-6+ para el pañal,
  "Sin indicar"/10/20/30/45min para la toma). Solo preseleccionan al
  CREAR una entrada nueva (`openSheet()` en `DashboardView.vue`) -
  editar una ya existente sigue mostrando siempre su propio valor
  guardado, nunca este por defecto.
- **Talla del pañal, opcional, al crear/editar un cambio** (`api`:
  columna `size` nullable en `diaper_changes`, enum `DiaperSize`
  ('1'..'5','6+' - sin "RN", a petición expresa; estándar genérico, no
  ligado a una marca concreta), validación `nullable` + `Rule::enum` en
  ambos FormRequest, mismo patrón que `residue_color` salvo que no
  depende del tipo de pañal - una talla aplica igual a mojado, sucio o
  ambos. `web`: grupo de radios (`role="radiogroup"`) en "+ Pañal",
  mismo estilo de chip que ya usa "Sin indicar" del color de las heces,
  justo antes del selector de "Cuándo"). La talla, cuando se indicó,
  se muestra también en la línea temporal - `entryDiaperSizeLabel()`
  en `DashboardView.vue` rellena el mismo badge que ya usaba la
  duración de una toma/sueño (`entryDuration()`, `undefined` siempre
  para un pañal, que no tiene concepto de duración), así que "Talla 1"
  sale junto a los iconos de tipo exactamente igual que "10min" sale
  junto a la gota de leche. Sin talla indicada, la fila se queda solo
  con los iconos, como ya hacía antes de que existiera este campo.
- **El peso de un registro de crecimiento admite dos decimales**
  (`growth-weight` en `DashboardView.vue`): el campo llevaba
  `step="0.1"`, que limita los incrementos de las flechas nativas del
  `<input type="number">` a décimas y puede marcar como inválido un
  valor con más precisión (p.ej. `3.22`) según el navegador. El propio
  backend ya guardaba gramos enteros (`weight_grams`, sin cambios ahí:
  3.22kg → 3220g, tan exacto como 3.2kg → 3200g) y el listado ya
  mostraba dos decimales (`toFixed(2)`) - solo el formulario de entrada
  se quedaba corto. Ahora `step="0.01"`.
- **La línea temporal ya no repite la fecha junto a la hora**
  (`DashboardView.vue`): cada fila ya vive agrupada bajo un separador de
  día (`5 de octubre de 2026`), así que llevar la fecha completa también
  en el `meta` de cada tarjeta era puro ruido - ahora solo la hora
  (`toLocaleTimeString`). La propia hora pasa a `text-sm` (antes `text-xs`,
  el mismo tamaño que la descripción) para que no quede perdida frente al
  resto de la fila.
- **La pastilla de duración/tipo de la línea temporal desaparece: la
  hora pasa a ser una marca de tiempo discreta a la derecha, y el
  estado (duración + icono de tipo) vive en la segunda línea del
  propio texto** (`EntryCard.vue`). Varios intentos previos (pastilla
  con ancho mínimo compartido, con carril invisible, centrada o
  justificada a la izquierda...) intentaban arreglar el mismo síntoma
  - bordes de la pastilla desalineados entre filas - sin cuestionar si
  debía seguir siendo una pastilla aparte. La solución que se queda:
  quitar la pastilla por completo. El icono de gota (tipo de leche en
  una toma, orina en un pañal), el de caca y el 💤 de un sueño
  terminado, junto con el texto de duración, pasan a ser la segunda
  línea de la columna de texto (color de categoría, sin fondo); la
  hora, que antes ocupaba esa línea, se encoge a una marca de tiempo
  pequeña y muda en el lado derecho de la fila, junto al icono de
  borrar - sin competir por ancho con nada, porque ya no hay pastilla
  con la que alinearse. Sin duración/tipo que mostrar (crecimiento,
  hitos, predicciones), la hora se queda donde siempre ha estado, sin
  cambios.

  Un sueño todavía en curso (sin `ended_at`, con su propio botón
  "Finalizar" en vez de duración) no lleva el 💤 junto al texto - vive
  dentro del propio botón, al final, con su misma animación de
  "respirar" (`DashboardView.vue`, único sitio que ya la usa).
- **El campo "Termina" de un sueño usa ahora la rueda, como "Empieza"**
  (seguía con el `<input type="datetime-local">` nativo, única pieza del
  formulario que no lo había hecho): junto a ella, un interruptor
  "Sigue durmiendo" (`sleepStillOngoing` en `DashboardView.vue`) - a
  diferencia del nativo, que representa "sin fin todavía" con solo
  dejarlo vacío, la rueda siempre muestra un día/hora/minuto concreto,
  así que necesita un control aparte para ese estado. Activado por
  defecto al crear (oculta la rueda, `ended_at` se manda `null`); al
  editar, arranca según tenga o no `ended_at` ya guardado - y si no lo
  tiene, la rueda igualmente parte de "ahora mismo" por si se
  desactiva el interruptor, no de un valor vacío que no sabría
  representar. Bug real encontrado en un móvil (captura en mano): el
  texto "Sigue durmiendo" solo se mandaba como `aria-label` del propio
  interruptor - nunca llegaba a pintarse en pantalla, así que se veía
  un interruptor sin ningún texto al lado, sin explicar qué hacía. Vive
  ahora también como texto visible, no solo accesible.
- **Botón "Finalizar" directamente en la tarjeta de un sueño en curso**
  (línea temporal): solo cuando el sueño está en curso (`entrySleepPulsing()`,
  el mismo criterio que ya usaba el 💤 pulsante). Guarda directamente al
  pulsarlo (`ended_at` a "ahora mismo"), sin abrir ningún formulario a
  confirmar - un sueño solo lleva una fecha que fijar, no hay nada más
  que repasar antes de guardar; si se pulsó por error, la propia fila ya
  permite editarlo después como cualquier otra entrada. Mientras el
  sueño está en curso no lleva badge de duración - solo el botón, sin
  ruido de un contador en vivo al lado; el badge aparece una vez tiene
  `ended_at` de verdad.

  `EntryCard.vue` gana un slot nuevo, `#primaryAction` - distinto de
  `#actions` (el de borrar, revelado por swipe). Un primer intento metió
  el "Finalizar" dentro de `#actions`, que con `swipe_to_delete_enabled`
  activado solo se revela deslizando la fila hacia la izquierda - para
  una acción no destructiva que debe verse siempre, sin gesto de por
  medio, hacía falta un sitio propio. La versión final separa el panel
  visible en reposo (icono, título, badge y ahora `#primaryAction`,
  todos con el mismo fondo de categoría) del panel de borrar, que vive
  aparte y solo se revela deslizando - así el botón queda "dentro" de la
  tarjeta de verdad (junto al texto, antes del puller), no colgando
  fuera de ella ni escondido tras el swipe. `#primaryAction` es hermano
  del `<button>` clicable del row, no contenido dentro de él, ya que
  anidar un botón dentro de otro es HTML inválido.

  Un primer intento añadió también una tarjeta equivalente para una
  "toma de pecho en curso" (encima de todo lo demás en el Dashboard, con
  su propio "Finalizar"), pero se retiró: a diferencia del sueño, una
  toma sin `ended_at` no significa "en curso" - es sencillamente el
  estado normal de no haber indicado duración (opcional), así que la
  tarjeta salía siempre que la última toma de pecho cargada no tuviera
  duración, aunque fuera de hace horas. La duración de una toma se seguía
  pudiendo indicar - y editar luego si hacía falta - desde el propio
  selector del formulario (ver más abajo).
- **Duración de la toma al pecho, con selector de minutos estándar**
  (`api`: migración ninguna falta — `feeds.ended_at` ya existía en la
  tabla y en el modelo, solo sin usar desde el frontend; se le añade
  `prohibited_unless:type,pecho` a su validación, mismo patrón que
  `side`/`milk_type`. `web`: nuevo selector "Sin indicar"/10/20/30/45 min
  en "+ Toma" cuando el tipo es pecho, mismo estilo de chips que ya usa
  el color de las heces del pañal — simplificado desde un primer intento
  con 6 opciones, a petición expresa). Se envía como `started_at` + los
  minutos elegidos, no como un `ended_at` absoluto aparte - si se toca la
  hora de inicio sin tocar la duración, el fin se mueve con ella. Si la
  toma acaba de empezar, los minutos elegidos aún no han pasado del todo
  y caerían en el futuro (la API rechaza cualquier `ended_at` futuro) -
  en vez de obligar a esperar a que la toma termine de verdad para poder
  guardar la duración, se recorta al instante actual. `ended_at` se manda
  siempre explícito (`null` cuando no aplica, nunca omitido) - omitir la
  clave del todo al editar dejaba la duración vieja sin tocar en la fila
  (Laravel solo pisa las columnas presentes en el array validado), así
  que poner "Sin indicar" en una toma que ya tenía duración no la
  borraba pese al aviso de "Toma actualizada". Biberón y sólido no
  llevan duración (no es un dato que se suela cronometrar fuera del
  pecho).
- **Duración de sueño/toma como `badge` en la línea temporal**
  (`EntryCard.vue`, `DashboardView.vue`): el `badge` del componente ya
  existía pero ningún sitio lo usaba — ahora las entradas de sueño
  muestran su duración ("2h 15min") a la derecha, calculada desde
  `started_at`/`ended_at` (o hasta ahora mismo si sigue en curso), y las
  tomas al pecho con duración indicada hacen lo mismo. Antes solo se veía
  la hora de inicio, sin ninguna pista de cuánto había durado sin abrir
  la entrada a editarla. Ancho mínimo y texto centrado en el propio
  badge - sin esto, "15min" y "2h 15min" generaban píldoras de anchos
  muy distintos que no se leían alineadas entre sí fila a fila.
- **Sonido al cambiar de bebé, al abrir "Tu cuenta" y al activar/
  desactivar un acceso de la barra principal**: tres controles sin
  ningún `feedback.*` hasta ahora. El selector de bebé (`select()`, igual
  que `SegmentedControl.vue` - nada al re-tocar el ya activo, ya cubierto
  por su propio guard) y los accesos de la barra (`tap()`, mismo criterio
  que el resto de ajustes guardado-al-vuelo de `AccountSheet.vue`) viven
  en `DashboardView.vue`/`AccountSheet.vue`; el botón de perfil
  (`onOpenAccountSheet()`, `tap()`) en `AppHeader.vue`, que hasta ahora no
  importaba `useFeedback` en absoluto.
- **Sonido en las flechas de navegación del "Ritmo"** (`DailyRhythm.vue`):
  `tap()` al cambiar de día (anterior/siguiente), mismas flechas que ya
  tenían icono pero ningún sonido/vibración.
- **Indicador visual de la fila elegida en `WheelColumn.vue`** (día/mes/
  año del alta de bebé, día/hora/minuto de `DateTimeWheel.vue`): además
  de la banda de fondo ya existente, ahora el propio texto de la fila
  centrada cambia a negrita y color de marca, en tiempo real mientras se
  desliza (no solo al asentarse) — reportado en vivo: en la rueda de día,
  con etiquetas como "Hoy"/"Ayer", el valor elegido ya se leía claro por
  el propio texto, pero en las de hora/minuto (solo dos dígitos) no había
  ninguna diferencia visual entre la fila central y el resto más allá de
  la banda.
- **Sonido en los selectores de tipo de leche, tipo de pañal, color de
  las heces y categoría de hito**: estos cuatro grupos de botones no usan
  `SegmentedControl.vue` (llevan icono/swatch de color propio por opción,
  no solo texto), así que se habían quedado sin el `feedback.select()`
  que ya suena en tipo de toma, lado, sexo del bebé e idioma. Mismo
  criterio en los tres primeros (sin sonido al re-tocar la opción ya
  activa, no hay cambio real); la categoría de hito suena siempre, porque
  ahí tocar la ya activa sí es un cambio real (la deselecciona).
- **Selector de fecha/hora propio en los formularios de toma, pañal e
  inicio de sueño** (`DateTimeWheel.vue`, nuevo): sustituye al
  `<input type="datetime-local">` nativo en esos tres campos. El motivo
  no es solo estético - el selector nativo lo dibuja el propio sistema
  operativo fuera del DOM de la página, así que no hay forma de engancharle
  un sonido por cada fila mientras se desliza (solo un evento al
  confirmar). `DateTimeWheel.vue` son tres `WheelColumn.vue` normales (día,
  hora, minuto) que ya suenan solas - "Hoy"/"Ayer" para los dos días más
  cercanos, fecha corta para el resto, acotado al `min` del formulario
  (nacimiento del bebé u hora de inicio del sueño para su propio fin) o a
  90 días atrás por defecto. El modelo sigue siendo el mismo string que ya
  producía el datetime-local, así que el resto del formulario (conversión
  a/desde UTC, valor por defecto al abrir la hoja...) no cambia. **El
  campo "Fin del sueño" se queda con el input nativo de siempre** - puede
  dejarse vacío a propósito ("sigue durmiendo"), algo que una rueda no
  representa sin un interruptor aparte.
- **Sonido al deslizar el selector tipo rueda** (`WheelColumn.vue`, usado
  en el asistente de "Añadir bebé" para día/mes/año): un tono muy corto y
  discreto (`feedback.tick()`, nuevo en `useFeedback.ts`) suena cada vez
  que el dedo cruza una fila al deslizar, como el clic de un dial físico -
  independiente del valor que queda seleccionado al soltar (que sigue
  emitiendo `update:modelValue` solo una vez, al asentarse). Mismo
  interruptor de "Tu cuenta" que el resto de sonidos de interacción.
- **Barrido circular al cambiar de tema** (`ThemeToggle.vue`): en vez de un
  cambio instantáneo, un círculo crece desde el propio botón cubriendo la
  pantalla con el tema nuevo - como un amanecer/atardecer. Usa la View
  Transitions API nativa (Chrome/Edge, Safari 18+) animando el recorte
  circular de la captura del tema nuevo con Web Animations API; en
  navegadores sin soporte, o con `prefers-reduced-motion` activado, cae al
  cambio instantáneo de siempre. El color del halo no está fijado a mano:
  es la propia captura del tema de destino asomando por el círculo, así
  que sale oscuro al pasar a oscuro y claro al pasar a claro sin lógica
  adicional.
- **Pantalla de bienvenida fusionada** (`WelcomeView.vue`, ruta
  `/bienvenida`), inspirada en la app Napper pero con la identidad visual
  propia de PequeDex: fondo de 3 esferas difuminadas en el degradado de
  marca (mismo que `AppMark`/`favicon.svg`), oscilando lento
  (`prefers-reduced-motion` respetado), con tres puntos de entrada -
  "Iniciar sesión", "Crear un nuevo perfil de bebé" y "Tengo una
  invitación" - en vez de un formulario. Sustituye a `/login` como
  destino por defecto sin sesión (`router.beforeEach`); Login y Registro
  siguen existiendo como rutas propias, alcanzables desde aquí.
  `AppHeader` no se muestra en esta ruta (lleva su propia marca/pill de
  login sobre el fondo animado).
  **"Tengo una invitación" ya no requiere cuenta previa**: hasta ahora
  unirte a un bebé compartido (`POST /babies/join`) solo existía tras
  iniciar sesión, así que ese botón no tenía a dónde ir sin antes crear
  cuenta por separado. `RegisterView.vue` gana un campo opcional "Código
  de invitación" (precargado si llegas con `?invite_code=` en la URL, un
  deep link que ya puede compartir cualquier cuidador desde "Tu cuenta");
  `AuthController::register()` valida el código
  (`exists:babies,invite_code`, misma regla que ya usa `JoinBabyRequest`)
  y une al usuario al bebé en el mismo paso, envuelto en una transacción
  (mismo motivo que `BabyController::store()`) para que un fallo a medias
  nunca deje una cuenta creada pero sin el bebé de la invitación.
  Sin un `invite_code` ya en la URL, "Tengo una invitación" y "Crear un
  nuevo perfil de bebé" llevaban al mismo `RegisterView` sin ninguna
  diferencia visible - el enlace añade `?intent=invite`, y
  `RegisterView` hace scroll y foco automáticos al campo del código al
  detectarlo. Varios ajustes visuales tras revisión: el logo/nombre
  centrado, bajado de posición y agrandado, con dedos y corazón
  animados (`AppMark`, ver más abajo); la píldora "Iniciar sesión" con
  más separación del borde (misma distancia arriba que a la derecha) y
  un borde en color de marca en vez de uno neutro; el tagline
  reescrito ("Todo el cuidado de tu bebé, en un solo diario") para
  dejar claro que registra datos concretos, no un diario de texto
  libre.

- **Un solo botón en el splash, no dos**: "Crear un nuevo perfil de
  bebé" y "Tengo una invitación" llevaban al mismo `RegisterView` (con
  el mismo campo opcional de código de invitación), la única
  diferencia era el foco automático en ese campo cuando venías de un
  deep link - dos caminos para el mismo destino se sentían como uno de
  más. Un solo botón "Crear cuenta" (ahora al 80% del ancho de la
  pantalla, no a todo el ancho) cubre los dos casos: sin `invite_code`
  en la URL va directo al registro normal, con `invite_code` lleva el
  mismo query + `intent=invite` que ya activaba el foco automático.

- **Asistente paso a paso para crear el perfil del bebé**
  (`BabyOnboardingWizard.vue`), al estilo Napper, en vez del formulario
  plano de siempre (nombre, fecha prevista y sexo todos juntos): una
  pregunta por pantalla, con puntos de progreso, un "Saltar" que salta
  directo a la confirmación desde cualquier paso (todo sigue siendo
  opcional), la fecha prevista con un selector de rueda por
  día/mes/año (`WheelColumn.vue`, nuevo componente genérico con
  scroll-snap - también clicable directamente en un valor, no solo
  deslizable, para quien usa ratón en vez de dedo) en vez de un
  `<input type="date">`, el sexo con tarjetas grandes tocables en vez
  del `SegmentedControl` pequeño, y una pantalla de confirmación final
  con el `AppMark` animado (`beatHeart`) antes de crear el bebé. Se
  decidió tras probar dos borradores interactivos en un artefacto
  (este paso a paso vs. una sola pantalla con controles más táctiles).
  Sustituye al formulario tanto en el onboarding inicial como en la
  hoja "Añadir otro bebé"; el flujo de "unirme con un código de
  invitación" no cambia en ninguno de los dos sitios. El toast al
  unirte a un bebé compartido pasa de "Te has unido." a "Te has unido
  al diario de {nombre}.".

- **Logo del header enlazado a inicio**: "PequeDex" en `AppHeader` era
  un `<span>` estático, sin salida desde Login o Registro salvo el
  botón atrás del navegador. Ahora es un `RouterLink` a `welcome` (sin
  sesión) o `dashboard` (con sesión).

- **`AppMark` con animación propia de dedos y corazón**: sustituye al
  único modo `animated` que tenía antes (bob de todo el pie + latido
  rápido, solo en la pantalla de carga del Dashboard) por dos props
  independientes, `wiggleToes` y `beatHeart` - cada uno de los 4 dedos
  bobea con su propio retardo, el corazón late a un ritmo más lento y
  separado. El mismo movimiento se usa ahora tanto en el splash como en
  la carga del Dashboard, en vez de dos animaciones distintas para el
  mismo logo.

- **PWA instalable de verdad**: en Chrome Android, "Instalar app" ofrecía
  solo "Crear acceso directo" (una pestaña de Chrome con un icono, no una
  app independiente) porque faltaban `manifest.webmanifest` y un service
  worker - los dos requisitos mínimos de Chrome para el criterio de
  instalabilidad, más allá de qué haga ese service worker. Añadidos
  ambos, calcados del mismo patrón ya usado en LudoDex/MIRA_MarketLens:
  `public/manifest.webmanifest` (iconos 192/512/maskable-512, generados
  a partir de `favicon.svg`, `start_url`/`scope` en `/PequeDex/` porque
  GitHub Pages sirve esto como project page, no en la raíz del dominio) y
  `public/sw.js` (sin caché real - la app habla con una API en vivo y no
  tiene historia offline -, solo existe porque Chrome exige un fetch
  handler registrado para ofrecer la instalación completa). También
  `favicon.ico`/`favicon-32.png`/`apple-touch-icon.png` y las meta
  `apple-mobile-web-app-*`/`theme-color` en `index.html`, mismo criterio
  que los otros dos proyectos.

- **Interactividad táctil** (propuesta completa en un artefacto,
  "adelante con todas"): el brillo de `.btn-primary`, el anillo de
  color de `EntryCard` y el giro de icono en `ActionBar` solo se
  disparaban en `:hover` - invisibles en móvil, sin cursor que los
  active. Añadido `:active`/`.is-pressed`/`group-active` junto a cada
  `:hover`/`group-hover` existente. `BottomSheet.vue` gana arrastre
  real del tirador para cerrar (resistencia tipo goma desde 60px,
  cierra por encima de 110px). `toast.ts` añade un pulso de
  `navigator.vibrate()` al mostrarse (feature-detected, silencioso
  donde no existe). Stepper +/-10ml junto al campo numérico de
  cantidad al registrar un biberón, con pulsación mantenida repitiendo
  el ajuste. **Swipe-to-delete opcional en `EntryCard`**, nuevo toggle
  "Borrar con swipe" en Perfil (desactivado por defecto - la papelera
  siempre visible no cambia para nadie que no lo active): revela el
  mismo botón de borrar existente deslizando la fila en vez de
  mostrarlo siempre inline, sin duplicar su lógica. Deliberadamente
  fuera de esta pasada, por decisión explícita (`no compensa` frente
  al riesgo de tocar el scroll nativo de toda la app): pull-to-refresh
  en el dashboard.
- **Emoji 💤 junto a una fila de sueño en la línea temporal**, con dos
  variantes según el estado: estático para un sueño ya terminado, con
  una respiración suave (opacidad + desplazamiento, `prefers-reduced-
  motion` respetado) para uno todavía en curso — "sigue durmiendo ahora
  mismo" se lee distinto de un vistazo que "durmió, ya se despertó".
  Emoji, no un icono SVG — mismo criterio ya usado en
  `lib/milestoneCategory.ts` para los hitos, no una convención nueva.
  Nuevas props genéricas `emoji`/`emojiPulsing` en `EntryCard.vue` (no
  específicas de sueño, reutilizables si hiciera falta en otro sitio).

- **El selector de tipo de pañal (Mojado/Sucio/Ambos) gana sus propios
  iconos de pipi/caca**, mismo criterio que ya se aplicó a tomas y al
  color de heces: reconocer de un vistazo, no leyendo texto. "Mojado"
  lleva una gota amarilla de pipi (color fijo, no elegible — el pis
  siempre es de ese color); "Sucio" lleva un icono de caca teñido con
  el color de heces ya seleccionado (marrón por defecto mientras no se
  haya elegido ninguno, o si se deja "Sin indicar" — nunca un icono sin
  color); "Ambos" lleva los dos a la vez, sin texto (los dos iconos ya
  lo dicen). El icono de "Sucio"/"Ambos" se actualiza en vivo al elegir
  un color en el selector de debajo. Trasladado también a la línea
  temporal: cada pañal muestra ahora los mismos iconos que llevó al
  guardarse (gota de pipi, caca del color guardado, o ambos), en vez
  del punto de color plano que había antes — nuevo
  `DIAPER_PEE_COLOR` en `lib/diaperResidueColor.ts` y nueva prop
  `poopColor` en `EntryCard.vue` (un icono nuevo, remolino de círculos
  apilados, no un emoji — así se puede teñir con el color real).

- **El propio selector de "Calostro"/"Leche" en "+ Toma" lleva ahora la
  misma gota que luego se ve en la línea temporal**, no solo el texto —
  dorada junto a "Calostro", blanca junto a "Leche", para que el
  cuidador ya sepa qué aspecto va a tener antes de guardar. Deja de ser
  un `SegmentedControl` genérico (solo texto) y pasa a un control
  propio con la gota + etiqueta en cada botón, mismo color que ya
  define `lib/milkType.ts`.

- **La gota de leche/calostro cubre también el biberón, y las tomas de
  pecho antiguas sin dato.** Reportado en vivo: la gota solo aparecía
  en tomas de pecho recientes, dejando el resto de la línea temporal
  (biberón, y cualquier toma de pecho registrada antes de que este
  campo existiera) sin ella — un hueco inconsistente, no una ausencia
  real de leche. El biberón lleva ahora la misma gota blanca que
  "Leche" (fórmula o leche extraída, ambas blancas), y una toma de
  pecho sin `milk_type` guardado (dato antiguo, nunca se rellena solo)
  cae al mismo blanco por defecto, igual que ya hace el propio
  formulario "+ Toma" al crear una nueva. Solo una toma sólida se
  queda sin gota, al no ser leche en absoluto.

- **Gota de color junto a una toma de pecho en la línea temporal**,
  mismo criterio que el punto de color de un pañal sucio: dorada para
  calostro (su color real), blanca para leche — no un texto que haya
  que leer. A diferencia del punto de pañal (que solo aparece si hay
  color indicado), aquí se muestra siempre para una toma de pecho, ya
  que el tipo de leche es un campo obligatorio en ese caso (nunca
  "sin indicar"); un biberón o una toma sólida no llevan gota, al no
  tener tipo de leche. Nuevo `lib/milkType.ts` con el mapa tipo→hex,
  mismo patrón que `lib/diaperResidueColor.ts`. Nueva prop
  `dropletColor` en `EntryCard.vue` (un icono de gota, no el punto
  plano de `swatchColor` — está ilustrando un líquido).

- **Punto de color junto a un pañal sucio en la línea temporal.** El
  color de las heces solo se veía al abrir la fila para editarla — se
  añade un pequeño círculo con el color real justo junto al texto
  ("Pañal (Sucio) ●"), mismo criterio que el propio selector: un
  vistazo basta para distinguirlo, sin necesidad de leer nada. No
  aparece en absoluto para un pañal solo mojado o sin color indicado,
  no un punto gris de "nada que ver". Nuevo `lib/diaperResidueColor.ts`
  con el mapa color→hex, compartido entre el selector (`DashboardView.vue`)
  y este punto, para que ambos sitios estén de acuerdo en qué aspecto
  tiene cada color.

- **Orden del dashboard: Hitos sube por encima de las predicciones.**
  Antes iba tarjetas resumen → predicción de próxima toma/sueño →
  Hitos → Ritmo; ahora es tarjetas resumen → Hitos → predicción →
  Ritmo, a petición de Odei tras usar la app a diario.

- **Las tarjetas resumen del dashboard (tomas/sueño/pañales) se
  recalculan al navegar por días anteriores en "Ritmo", y pierden la
  coletilla "hoy".** Antes mostraban siempre el recuento de hoy ("2
  tomas hoy") aunque "Ritmo" estuviera mostrando un día anterior —
  ahora reutilizan el mismo día que ya conoce el propio navegador de
  "Ritmo" (`rhythmDate`/`rhythmTimeline`, ya existentes) y muestran el
  recuento de ese día concreto, con "hoy" retirado de la etiqueta
  porque ya no es siempre cierto.

- **El selector de color de las heces pasa de texto a círculos de
  color real.** "Verde/Amarillo/Marrón/Meconio" como opciones de texto
  obligaba a leer la palabra para reconocer el pañal — un cuidador
  reconoce el color de un vistazo, no leyendo su nombre. Ahora cada
  opción es un círculo con el color real (el meconio, deliberadamente
  casi negro, no un "negro" plano), con una marca de verificación
  blanca sobre la opción elegida; "Sin indicar" se queda como texto,
  al no representar ningún color.

- **Tipo de leche en las tomas de pecho, color de las heces en pañales
  sucios.** El formulario de "+ Toma" solo distinguía biberón/pecho/
  sólido y, para pecho, el lado — ahora, al elegir pecho, aparece también
  "Tipo de leche" (Calostro / Leche, con Leche preseleccionada por
  defecto). El formulario de "+ Pañal" gana un selector de color de las
  heces (Verde / Amarillo / Marrón / Meconio, con "Sin indicar" como
  opción explícita) que solo aparece cuando el tipo es Sucio o Ambos — un
  pañal solo mojado no tiene heces que describir, así que ahí ni se
  muestra ni el backend lo acepta. Ambos campos son opcionales incluso
  cuando son relevantes (nadie está obligado a rellenarlos cada vez).

- **Selector de sexo al crear el primer bebé, eliminación de bebé para el
  cuidador único.** El formulario de onboarding ("Empieza con tu bebé")
  solo pedía nombre y fecha prevista de parto — el sexo (opcional, ya
  aceptado por el backend desde antes) solo se podía fijar después desde
  "Sexo / fecha de nacimiento"; ahora aparece también al crear el bebé
  (y al añadir un segundo bebé), reutilizando el mismo `SegmentedControl`.
  Además, un cuidador único no tenía forma de eliminar un bebé del todo —
  "Dejar de cuidar al bebé" lo rechaza explícitamente en ese caso (dejaría
  el bebé sin ningún cuidador), así que la única salida real era compartir
  el código de invitación con alguien más primero. Nuevo endpoint
  `DELETE /babies/{baby}` (solo permitido con un único cuidador vinculado,
  mismo bloqueo con `lockForUpdate()` que ya usaba "dejar de cuidar" contra
  una carrera entre dos peticiones simultáneas) borra el bebé y cuanto
  cuelga de él (`cascadeOnDelete` ya cubría feeds/sueños/pañales/medidas/
  hitos/contracciones; las fotos de hitos viven en disco, no en la BD, así
  que se limpian a mano antes del borrado). En el frontend, cuando "Dejar
  de cuidar" falla por ser el único cuidador, la propia hoja de ajustes
  ofrece "Eliminar este bebé" como alternativa justo debajo del error.

- **El enlace "eliminar todas las contracciones" se mueve al final del
  contador de contracciones.** Vivía en la hoja de ajustes del bebé
  (Sexo/fecha de nacimiento), siempre visible mientras el bebé no hubiera
  nacido, incluso sin ninguna contracción guardada — no había nada que
  borrar. Ahora vive al final de `/contracciones`, la página que de hecho
  sabe si hay contracciones cargadas, y solo aparece cuando las hay.

- **Tercera ronda de movimiento — transiciones en crecimiento, contracciones
  e hitos, mismo criterio que LudoDex y MIRA_MarketLens (proyectos
  hermanos).** La lista de "Crecimiento" del dashboard, que estaba al lado
  de la línea temporal principal sin compartir su `TransitionGroup`, ahora
  lo usa igual (mismo `EntryCard`, mismas transiciones `entry-list-*` ya
  definidas). `ContractionTimeline.vue` se reestructuró — cada contracción
  pintaba hasta 3 `<li>` sueltos por iteración (separador de día, chip de
  intervalo, fila), agrupados ahora en un único `<li>` por contracción sin
  cambiar el layout visual — para poder animar entrada/salida/renumerado al
  añadir, borrar o iniciar una contracción. `MilestoneStories.vue` (la fila
  de "stories" de hitos) gana un pop de entrada (escala+rotación) al añadir
  un hito nuevo — antes aparecía ya puesto, sin celebrar su llegada como sí
  hace el resto de la app. De paso, el mismo bug de `.btn-primary:active`
  enmascarado por `disabled` síncrono ya arreglado en LudoDex/MIRA
  (`v-press`, `directives/press.ts`) se portó tal cual a ~19 botones reales
  (formularios de auth, hojas de registro rápido, AccountSheet,
  ContractionsView).

- Segunda fase del catálogo de movimiento, esta vez sobre cómo entran y
  cambian los bloques del dashboard en vez de cómo responde un botón al
  pulsarlo: las tarjetas de "hoy" cuentan hasta el nuevo valor y se
  destellan al cambiar en vez de saltar de golpe; las barras de "Sueño
  esta semana" crecen desde el suelo en cascada; las marcas de
  "Ritmo de hoy" aparecen en cascada ordenadas por su posición real en
  la barra (en la primera carga y cada vez que se cambia de día), y el
  título del día desliza en la dirección navegada en vez de cortar de
  golpe; cambiar entre Dashboard y Contracciones cruza con un fundido
  breve en vez de un corte seco; y las tarjetas de predicción de
  toma/sueño ganan un halo suave que se activa en cuanto la hora
  estimada llega o pasa. Deliberadamente sin tocar: el `AppMark`
  animado de la pantalla de carga, que ya es un diseño de marca a
  propósito y no un spinner genérico a sustituir.
- Micro-animaciones disparadas al tocar/hacer clic (no al `:hover`, explorado
  antes en un artefacto con 10 propuestas comparadas en contexto) en varias
  interacciones reales: "Guardar" en "Tu cuenta" se convierte un instante en
  un check dibujado a trazo, el interruptor de predicciones gana una curva de
  rebote, el botón de eliminar de la línea temporal sacude el icono al
  tocarlo, el corazón de "me gusta" de un hito suelta un puñado de partículas
  al confirmarse, la barra de accesos rápidos gana un ripple desde el punto
  exacto del toque, los 3 rayos de intensidad de una contracción se rellenan
  en cascada, el botón de inicio/detener de contracciones gana un anillo que
  respira mientras está en marcha, exportar el PDF muestra un anillo de
  progreso alrededor del propio icono, y las confirmaciones peligrosas
  ("Dejar de cuidar al bebé", "Eliminar todas las contracciones") se expanden
  con una sacudida de aviso en vez de aparecer de golpe. Todas respetan
  `prefers-reduced-motion`.
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

- **Sonidos para dormir** (`SoundsView.vue`, ruta `/sonidos`): rejilla
  de 6 categorías (ruido blanco, lluvia, latido, nana, olas,
  ventilador) y un reproductor con temporizador (15/30/45/60 min o sin
  límite) y fundido de volumen en el último 10% del tiempo, en vez de
  cortar en seco. Validado primero con un borrador interactivo (artifact
  HTML con los tokens reales de la app) antes de tocar código.
  Entrada nueva en el Dashboard, junto a la de Contracciones, pero
  `v-if="babies.current"` sin más (sin el `!isBorn` de aquella — tiene
  sentido también después de nacer) y con `bg-brand-teal` en vez de
  `bg-sleep`, para no reutilizar el color de la categoría de registro
  "Sueño" en una tarjeta que no tiene nada que ver con esa taxonomía.
  "Ruido blanco" no usa ningún fichero de audio: se genera en el
  momento con Web Audio (`AudioContext` + un buffer de ruido +
  `GainNode` para el fundido). Las otras 5 categorías reproducen un
  `<audio>` apuntando a `public/sounds/<categoría>.mp3` — ficheros que
  no existen todavía (llegarán con licencia más adelante); mientras
  tanto, el propio evento `error` del `<audio>` marca la categoría como
  "Audio pendiente" en su tarjeta en vez de dejarla "reproduciendo"
  para siempre.
  El estado (categoría activa, cuenta atrás, si está sonando) vive en
  `useSoundPlayer.ts`, el primer composable del repo: un singleton a
  nivel de módulo (mismo criterio que `useTheme.ts` de LudoDex), no
  estado local de la vista — el sonido debe seguir sonando si el
  usuario navega fuera de `/sonidos`, que es justo el punto de la
  función. Última categoría/duración elegida persistida en
  `localStorage`, mismo patrón de guardas que `theme.ts`. Wireado
  también un `navigator.mediaSession` básico (metadata + controles de
  play/pause en la pantalla de bloqueo), como mejor esfuerzo — un PWA
  puede seguir siendo suspendido en segundo plano por el sistema
  operativo pese a esto, no es una garantía.

- **Interruptor "Tarjetas resumen del día"** en "Tu cuenta" — tercera
  copia exacta del patrón ya usado por "Predicciones"/"Borrar con
  swipe": columna `users.today_summary_enabled` (booleana,
  `default(true)`), `PUT /user/today-summary`
  (`UpdateTodaySummaryEnabledRequest`, `required|boolean`), acción
  `auth.updateTodaySummaryEnabled()` con el mismo guardado-al-vuelo con
  reversión si falla. Muestra/oculta `TodaySummary.vue` (tomas/sueño/
  pañales bajo la tarjeta del bebé) con un `v-if` directo en su propia
  etiqueta en `DashboardView.vue`, sin tocar el componente — que ya se
  autogate por `stats.length > 0`. Activado por defecto.

- **Audio real para Tormenta/Latido/Olas** — los tres primeros
  ficheros reales de Sonidos para dormir (de 6 categorías, quedan
  Nana/Ventilador sin fichero, con "Audio pendiente" en su tarjeta).
  Recortados de ~1h a ~15 min desde las grabaciones originales que
  pasó Odei — el `<audio loop>` del navegador repite el fichero las
  veces que haga falta para la duración elegida en el temporizador
  (nada en `useSoundPlayer.ts` depende de la duración real del
  fichero), así que 15 min de textura continua sin melodía cubre de
  sobra incluso "Sin límite" sin que se note la repetición, a cambio
  de ~43 MB en vez de ~180 MB en el repo. Con un *crossfade* real de
  unos segundos entre el final del clip y su propio principio
  (`acrossfade` de `ffmpeg`, no un recorte a tijeretazo) para que el
  punto donde el bucle empalma consigo mismo no suene como un salto
  brusco. De paso, la categoría "Lluvia" pasa a llamarse "Tormenta"
  (`sounds.categories.rain`) — más fiel al contenido real del audio
  que Odei consiguió para esa categoría.

- **Audio real para Ventilador/Grillos** — los dos ficheros que
  faltaban de Sonidos para dormir, mismo recorte a ~15 min con
  *crossfade* sin costura que Tormenta/Latido/Olas. Ya no queda
  ninguna de las 6 categorías con "Audio pendiente". La categoría
  `lullaby` pasa a llamarse "Grillos" (`sounds.categories.lullaby`) en
  vez de "Nana" — id interno y nombre de fichero (`lullaby.mp3`) se
  quedan igual, solo cambia la etiqueta.

- **Tarjeta de Sonidos reubicada bajo las tarjetas resumen** — cuando
  el interruptor "Tarjetas resumen del día" está activo,
  `SoundsLinkCard.vue` (contenido extraído sin cambios de la tarjeta
  que antes iba siempre justo tras la del bebé) pasa a mostrarse justo
  debajo de `TodaySummary`, para que no se interponga entre la tarjeta
  del bebé y las tomas/sueño/pañales de hoy — lo primero que se mira
  al abrir la app. Con las tarjetas resumen desactivadas, o el bebé
  aún sin nacer, se queda en su sitio de siempre.

- **Color propio por categoría en los iconos de Sonidos** — los 6
  iconos del selector y del círculo "reproduciendo ahora" en
  `SoundsView.vue` compartían el mismo `bg-brand-teal/15
  text-brand-teal`; ahora cada categoría tiene su propio color (tokens
  `--sound-*` en `base.css`, con su variante clara/oscura, expuestos a
  Tailwind vía `@theme`, y `soundText`/`soundBg` en `soundCategory.ts`
  como mapas de clases — mismo patrón que `categoryText`/`categoryBg`
  de `lib/category.ts`) para distinguirlos de un vistazo. De paso,
  arreglado el icono de Ventilador: a las 3 aspas originales
  (arriba/derecha/izquierda) le faltaba la de abajo, así que se veía
  incompleto — añadida como reflejo vertical exacto de la de arriba,
  mismo trazado que las otras tres.

- **Fundido de entrada al arrancar cualquier sonido** en Sonidos para
  dormir — fijo (1.5s) e independiente de la duración total elegida en
  el temporizador, a diferencia del fundido de salida que sí escala
  con ella. El ruido blanco usa la automatización nativa de Web Audio
  (`GainNode.linearRampToValueAtTime`); los ficheros `<audio>` no
  tienen equivalente nativo para su `volume`, así que se sube a mano
  con un `setInterval` de pasos cada 100ms.

- **Animación de "reproduciendo" movida al icono de la tarjeta** — el
  círculo grande del panel inferior repetía el mismo icono de la
  tarjeta seleccionada en la rejilla, solo más grande; se elimina y el
  anillo respirando (`timer-ring`) pasa a vivir en el badge del icono
  de la tarjeta que está sonando en la rejilla, con `currentColor` en
  vez de un `brand-teal` fijo para heredar el color propio de cada
  categoría. El panel gana algo de peso para compensar (texto de
  estado más grande, botón de 20x20 en vez de 16x16), y el nombre de
  la categoría pasa a acompañar al verbo en el propio texto de estado
  ("Reproducir Grillos", "Reproducir Olas"…, clave `sounds.play` con
  un parámetro `{name}`) en vez de un título aparte.

- **Doble click/doble toque en una tarjeta de Sonidos reproduce o para
  su sonido** directamente, sin pasar por el botón de play — un primer
  toque sigue seleccionando la tarjeta como hasta ahora; un segundo
  toque rápido sobre la misma categoría la reproduce, o la para si ya
  estaba sonando. Detectado a mano por diferencia de tiempo entre
  clicks (400ms) en vez de con el `dblclick` nativo del navegador —
  más fiable en móvil, donde un PWA normalmente desactiva el zoom por
  doble toque y con ello el comportamiento nativo de `dblclick` varía
  según el navegador. Sin efecto sobre una categoría marcada como no
  disponible.

- **Sonido y vibración al interactuar con la interfaz**, con
  interruptor propio en "Tu cuenta" (cuarta copia exacta del patrón de
  Predicciones/Borrar con swipe/Tarjetas resumen, activado por
  defecto). Nuevo composable `useFeedback.ts`: 3 tonos cortos
  sintetizados con Web Audio (sin ningún fichero, mismo criterio que
  el ruido blanco de Sonidos para dormir) + `navigator.vibrate()` con
  feature-detect — en PC, y en iOS Safari (que nunca ha implementado
  la Vibration API), solo suena, sin vibrar. Enganchado en los puntos
  de interacción ya existentes en el código en vez de tocar cada
  botón de la app uno a uno: la directiva `v-press` (ya aplicada a
  ~20 botones primarios/submit) dispara la pulsación genérica,
  `ActionBar.vue`/`DeleteButton.vue`/`SoundsView.vue` cubren sus
  propios casos (cambio de categoría, confirmar borrado, play/stop de
  un sonido), y el `hapticBuzz()` que ya tenía `toast.ts` para sus
  toasts de éxito/error —hasta ahora sin pasar por ningún ajuste— se
  centraliza aquí, gateado igual que el resto.

- **5 tipos de sonido/vibración más en `useFeedback.ts`** —
  `cancel`/`select`/`nav`/`navBack`/`theme`, cada uno con timbre y
  patrón de vibración propios en vez de reutilizar el genérico `tap`:
  `select` en `SegmentedControl.vue` (idioma, duración de Sonidos,
  tipo de toma, sexo del bebé — cualquier selector de ese tipo, de un
  plumazo), `theme` al cambiar de modo claro/oscuro, `cancel` (un
  `playSweep()` nuevo, de frecuencia deslizante en vez de fija) en los
  botones "Cancelar" y en la rama "no" de los diálogos de
  confirmación, `nav` al entrar en Contracciones o Sonidos para dormir
  desde el Dashboard — un arpegio de 3 notas ascendentes, tras
  descartar un primer intento con `playSweep()` que sonaba más a
  silbido que a confirmación — y `navBack` (las mismas 3 notas al
  revés, más apretadas) al pulsar el botón de volver en esas dos
  vistas. También `warnVibrate()` (solo vibración, sin tono) como
  preaviso a mitad del gesto de swipe-to-delete en `EntryCard.vue` —
  un pulso cuando el dedo ya ha revelado la mitad del panel de borrar,
  antes de soltarlo, ya que un sonido a mitad de un arrastre que aún
  se puede cancelar se sentiría fuera de lugar.

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

- **Un sonido podía quedar silenciado para siempre al cambiar la
  duración durante su fundido de salida** — encontrado en una revisión
  de fiabilidad del flujo de Sonidos para dormir tras varias
  iteraciones seguidas sobre `useSoundPlayer.ts`. `setDuration()`
  reiniciaba la cuenta atrás sin deshacer un fundido de salida que ya
  estuviera en marcha: para el ruido blanco,
  `gainNode.gain.linearRampToValueAtTime(0, …)` agenda una
  automatización de Web Audio en un instante *absoluto* que no se
  cancela sola solo porque la duración cambie después, así que seguía
  silenciando el ruido en su momento original — y si la nueva
  duración era "Sin límite", se quedaba mudo para siempre, porque en
  ese modo nada vuelve a comprobar el fundido. Para los ficheros
  `<audio>` (tormenta, latido…), el volumen se quedaba con el valor
  bajado del último tick, sin nada que lo restaurase. Se cancela la
  automatización pendiente (`cancelScheduledValues` + `setValueAtTime`
  de vuelta a la ganancia normal) o se restaura `audioEl.volume = 1`,
  pero solo cuando el cambio de duración ocurre realmente en fundido
  de salida — sin efecto durante el fundido de entrada. 3 tests
  nuevos para el caso; `setDuration()` no tenía ninguno hasta ahora.

- **Ruido blanco sonaba más fuerte que el resto de audios incluso al
  mínimo de volumen del dispositivo** — se genera a escala digital
  completa (`Math.random() * 2 - 1`, RMS de ~-4.8dBFS), mucho más
  fuerte que los ficheros mp3 reales (rain.mp3/fan.mp3 rondan -22.5dB
  de media, medido con `ffmpeg -af volumedetect`). La diferencia
  estaba en la propia señal generada, no en nada que el volumen del
  sistema pudiera compensar. Añadida una ganancia fija de 0.13 al
  `GainNode` (`10^((-22.5 - -4.8) / 20)`, el factor que iguala su RMS
  al de las otras categorías) en vez de 1.

- **Nombre del sonido en la notificación/pantalla de bloqueo en
  inglés y sin traducir** (visto en Android) —
  `navigator.mediaSession.metadata` usaba el id interno tal cual (ej.
  `"waves"`, `"fan"`) como título, sin pasar por i18n. Se traduce con
  el mismo `i18n.global.t` que usa el resto de la app fuera de
  componentes, a partir del `labelKey` de `SOUND_CATEGORIES`, y se
  capitaliza la primera letra por si alguna traducción no la trae ya
  en mayúscula.

- **Iconos de instalación de la PWA sin contraste** — `icon-192`/`icon-512`/
  `icon-maskable-512`/`apple-touch-icon` tenían fondo transparente (las
  variantes "any") o rosa sólido (la maskable) — el mismo rosa con el
  que empieza el degradado del pie, así que la parte de arriba de la
  huella se fundía con el fondo y no se distinguía bien al instalar la
  app en el móvil. Fondo crema sólido (`#fbf7f2`, el mismo `--bg`/
  `background_color` del resto de la app) en las 4 variantes, huella
  recentrada y reescalada; en la maskable, dentro de la zona segura del
  80% que recortan los distintos launchers (círculo, squircle, cuadrado
  redondeado).
- **Dedo cortado en la animación de `AppMark`** — tres de los cuatro
  dedos llevan su propio atributo SVG `transform="rotate(...)"`; al
  animar con `transform: translateY(...)` vía CSS, ese transform
  sustituía por completo al atributo en vez de combinarse con él, así
  que el dedo perdía su rotación en cuanto arrancaba la animación y
  aparecía desplazado/cortado contra la almohadilla. Cambiado a la
  propiedad CSS `translate` (independiente de `transform`), que no
  tiene ese conflicto.
- **Pantalla en blanco al cerrar sesión** — `router.push` tras
  `auth.logout()` nunca se ejecutaba si la propia petición
  `POST /logout` fallaba (token ya caducado, red...), aunque
  `auth.logout()` ya limpia la sesión local en su propio `finally`. Se
  quedaba montado el Dashboard, ahora sin `auth.user`, con pantalla en
  blanco como resultado. Un `try/finally` en `AppHeader.onLogout`
  garantiza la redirección (a `welcome`) pase lo que pase con la
  petición.
- **La pantalla seguía en blanco tras el arreglo anterior** — la
  redirección sí se disparaba, pero cualquier transición de ruta hacia
  o desde `welcome` bajo `mode="out-in"` (`App.vue`) se quedaba
  colgada para siempre: el router ya tenía la ruta y el componente
  correctos, pero el DOM no llegaba a pintar nada, ni la página vieja
  ni la nueva. Reproducido en vivo en Chrome y descartadas `v-show` en
  `AppHeader` y un `:duration` explícito antes de encontrar el arreglo
  real - `mode="out-in"` se desactiva ahora solo para las transiciones
  que tocan `welcome` (en cualquier dirección), y se mantiene para el
  resto de rutas (sigue evitando que `DashboardView`/`ContractionsView`
  monten dos veces sus intervalos de sondeo).
- **Parpadeo al cerrar sesión** — con la pantalla en blanco ya resuelta,
  quedaba un parpadeo real: `auth.logout()` limpiaba la sesión local
  (`auth.user`/`babies.current`) en su propio `finally` antes de que el
  `await` en `AppHeader` terminase de resolver, con el Dashboard
  todavía montado en ese instante - se re-renderizaba de forma
  reactiva contra ese estado ya vacío durante uno o varios frames,
  antes de que el `router.push` a `welcome` siquiera empezara.
  `auth.logout()` ahora limpia la sesión de forma síncrona (ya no es
  `async`) y dispara `POST /logout` en segundo plano sin esperarlo
  (con el token capturado explícito en la cabecera, ya que el
  interceptor de peticiones lo lee en un microtask posterior, después
  de que el token ya se habría limpiado); `AppHeader` llama a
  `logout()` y hace el `push` justo después, en el mismo tick, para
  que Vue agrupe ambos cambios reactivos en un solo render.
- **El parpadeo seguía pasando tras el arreglo anterior** — sin
  `out-in`, la página saliente y la entrante se renderizan a la vez
  (el modo por defecto de Vue): aunque ya no empuja el layout (ver
  arreglo anterior), seguía totalmente opaca durante la primera parte
  de su propio desvanecido, superpuesta con la entrante que a su vez
  seguía casi transparente al empezar su fundido - eso era el
  parpadeo, un instante del contenido viejo antes de que el splash
  terminara de aparecer. Verificado en vivo, en varias repeticiones
  limpias (servidor de Vite reiniciado, pestaña nueva) con inspección
  directa del DOM, no solo capturas. La página saliente ahora
  desaparece al instante (sin transición) en cuanto deja de ser la
  ruta activa, en vez de quedarse visible mientras se desvanece -
  nuevo par de clases (`route-instant-leave-*`) seleccionado
  dinámicamente en `App.vue` solo para las transiciones que tocan
  `welcome`; el resto de rutas sigue con el fundido secuencial de
  siempre.
- **Extensión `gd` ausente en el contenedor de producción** —
  `AvatarProcessor::process()` usa `imagecreatefromstring()` (ext-gd)
  para redimensionar avatares; el `Dockerfile` solo instalaba
  `pdo_pgsql` y `bcmath`, así que subir un avatar en producción
  fallaba con "Call to undefined function ... imagecreatefromstring()"
  (nunca fallaba en local, Laragon ya trae la extensión). Los uploads
  aceptan jpeg/png/webp, así que `gd` se compila con las librerías dev
  de jpeg y webp, no solo su build por defecto (que solo trae PNG).
- **Crear/editar toma, sueño, pañal, medida e hito con la misma
  sensación de lentitud que tenía el borrado** — mismo motivo: dos
  peticiones seguidas (el `POST`/`PUT` y luego un `GET` completo
  recargando toda la lista) antes de que la fila apareciera. La
  respuesta del propio `POST`/`PUT` ya es el registro completo
  (percentiles calculados, likedBy cargado...) - `upsertTimelineEntry`/
  `upsertByDate` la insertan o reposicionan en el array local ya
  ordenado en vez de sustituirlo por una recarga entera.
- **Borrado con sensación de lentitud** — no era el gesto ni la
  animación: `deleteFeed`/`deleteSleep`/`deleteDiaperChange`/
  `deleteGrowthMeasurement`/`deleteMilestone` esperaban dos peticiones
  seguidas (el `DELETE` y luego un `GET` completo de toda la lista)
  antes de que nada cambiara en pantalla. Pasado a borrado optimista:
  la fila desaparece del array local de forma síncrona antes de la
  petición, con el array anterior guardado para restaurarlo si el
  `DELETE` falla - mismo patrón guardado-al-vuelo-con-rollback que ya
  usan los toggles de Perfil.
- **Tercera pasada sobre la interactividad táctil.** La reescritura a
  scroll-snap nativo (ver entrada anterior) arrastró una regresión
  real al modo clásico sin swipe: el fondo/padding se quedó solo en el
  botón principal, así que la tira de color no llegaba hasta el icono
  de borrar y este quedaba sin centrar ni padding - corregido
  devolviendo el fondo/padding al contenedor en ese modo. Añadido
  también: la fila que se borra ahora se saca del flujo
  (`position: absolute`) en cuanto empieza a desaparecer, para que el
  hueco se cierre a la vez que se desvanece (encogimiento + fade en
  vez de desplazamiento lateral) y no como un salto tras su propia
  transición; y un pequeño chevron atenuado, con balanceo sutil
  continuo, dentro de la fila (no en el cajón) para señalar que hay
  swipe disponible cuando está activado - sin él no había ninguna
  pista de que la entrada fuera deslizable.
- **Segunda pasada sobre la interactividad táctil, tras probarla de
  verdad en un dispositivo real** — reporte contundente: "el borrado
  por swipe es una basura". Reescrito por completo, de matemáticas de
  `pointermove` manuales a `overflow-x:auto` + `scroll-snap-x` nativo
  (el navegador aporta la física de momentum/rebote; el panel de
  acciones queda geométricamente fuera del viewport en reposo, no solo
  tapado por color); un bug real encontrado en la reconstrucción
  (`flex-1` fijo ganaba a `w-full` en flexbox, el contenedor nunca
  desbordaba) también corregido. `DeleteButton.vue` gana `:active`
  junto a `:hover` (estaba estático al tacto). Añadido, además:
  `appear` + retardo escalonado (`--stagger-index`) en la carga inicial
  de la línea temporal (antes aparecía todo de golpe); toast
  "Toma/Sueño/Pañal/Medida/Hito guardado(a)" al crear (nunca existió,
  solo al editar/borrar); cantidad de ml precargada a 10 en vez de
  vacía en el formulario de biberón. Dos puntos del reporte inicial no
  eran regresiones: la "píldora" Hoy/Semana/Crecimiento y los toasts al
  crear eran solo demos del artefacto de propuesta, nunca implementados
  de verdad hasta ahora.
- Ir a "Contador de contracciones" desde el dashboard, justo después de
  crear el primer bebé y sin recargar la página, dejaba la app en blanco
  (solo el nav superior visible) — reportado en vivo. `DashboardView.vue`
  tiene tres ramas (cargando / error / contenido); la rama "hay bebé"
  renderizaba `<main>` + `<ActionBar>` + cada `<BottomSheet>` +
  `<MilestoneStoryViewer>` como hermanos sueltos en la raíz de la
  plantilla — un Fragment, no un único elemento — y App.vue envuelve la
  vista activa en `<Transition name="route" mode="out-in">`, que exige
  una raíz de elemento único para poder animar la salida: con un
  Fragment, esa transición nunca llegaba a resolverse y la siguiente
  vista no llegaba a montarse. Solo aparecía a partir de tener un bebé
  (la rama de onboarding, con un único `<main>`, nunca tuvo el problema).
  Arreglado envolviendo toda la plantilla en un único `<div>` — con
  `display: contents` el aviso de Vue desaparecía pero el bloqueo
  seguía (esa propiedad retira la caja pintable del elemento, y sin
  caja no hay `transitionend` que disparar), así que la caja real es
  `flex flex-1 flex-col`, mismo rol que cada rama ya usaba por su
  cuenta.

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
- **Pantalla en blanco al cambiar de ruta, en cualquier pareja de
  vistas** — `mode="out-in"` (`App.vue`) llevaba desde la pasada del
  splash con un bypass acotado solo a las transiciones que tocaban
  `welcome` (ver el arreglo de "la pantalla seguía en blanco" más
  arriba): se dio por resuelto en cuanto `welcome` funcionó, sin
  comprobar si el mismo problema afectaba a otras parejas de rutas.
  Reproducido en vivo, con clicks reales (no solo en pruebas
  automatizadas), en Dashboard ↔ Contracciones — sin `welcome` de por
  medio: tras una navegación por `RouterLink`, el `<main>` que se va se
  queda pegado para siempre con las clases de entrada y salida de Vue a
  la vez, sin pintar nada más; una recarga completa a la misma URL
  renderiza la vista correctamente cada vez, confirmando que el
  problema estaba en el mecanismo de transición del lado cliente, no en
  las vistas en sí. Confirmado también con un `git stash` sobre un
  checkout limpio: el bug ya existía antes de la pasada de Sonidos, no
  lo introdujo esa feature — simplemente nunca se había vuelto a probar
  desde el arreglo de `welcome`. `mode="out-in"` quitado globalmente en
  vez de seguir añadiendo cada ruta nueva a una lista de excepciones
  (le pasó exactamente eso a `/sonidos` al añadirla) — viejo y nuevo se
  montan ahora en simultáneo (el modo por defecto de Vue) con la salida
  instantánea que ya estaba probada para `welcome`, en vez de esperar
  un fin de transición que nunca llega a completarse. Cada intervalo de
  sondeo en Dashboard/Contracciones ya tiene su propio `onUnmounted`,
  así que el breve solape es inofensivo, no una fuga. Verificado en
  vivo, con clicks reales, en Dashboard ↔ Contracciones y Dashboard ↔
  Sonidos (con audio sonando de fondo durante la navegación), en la
  misma pestaña donde antes se colgaba de forma reproducible.