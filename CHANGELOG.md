# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este
proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

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