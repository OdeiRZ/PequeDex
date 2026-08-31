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
  su línea temporal combinada, y CRUD de tomas/sueño/pañales. Cada acción
  de crear/borrar vuelve a pedir la línea temporal entera en vez de tocar
  el array local a mano — el otro cuidador puede haber añadido algo entre
  medias, y el sondeo (ver más abajo) va a traer esa misma lista de
  todos modos. Mismo patrón para crecimiento e hitos (listas propias,
  no mezcladas en la línea temporal): crear/borrar vuelve a pedir la
  lista entera. `createMilestone()` construye un `FormData` a mano en
  vez de mandar JSON porque la foto es un archivo real, no una URL.
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
  con mucha menos frecuencia que tomas/sueño/pañales). Los cinco campos
  de fecha (toma/sueño/pañal/medida/hito) llevan `:min` calculado a
  partir de `babies.current?.birth_date` (`minDate`/`minDateTime`,
  `undefined` si el bebé todavía no tiene fecha de nacimiento): nada de
  eso tiene sentido antes de que el bebé haya nacido, y el propio
  navegador bloquea el envío con su aviso nativo si se intenta. La API
  aplica la misma regla por su cuenta (ver `api/README.md`), no solo el
  frontend. El avatar en `AppHeader.vue` abre una hoja de "Tu cuenta"
  (datos personales, idioma, contraseña, foto) - sheet propia, no una
  ruta nueva, mismo motivo que el resto de esta app: todo lo que no es
  login/registro vive en una sola vista. Como `AppHeader.vue` es global
  (vive en `App.vue`, no dentro de `DashboardView.vue`, donde está el
  contenido real de esa hoja) y no puede llamar a una función local de
  `DashboardView.vue`, ese flag de abrir/cerrar cruza el límite entre
  ambos vía `stores/ui.ts` - un store deliberadamente mínimo (un
  booleano y dos acciones), no una solución genérica para "cualquier
  sheet desde cualquier sitio" que nada más necesita todavía. El
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
  - **`MilestoneCard.vue`** — cuadrícula de dos columnas con la foto a
    tamaño de tarjeta (formato 4:3). El emoji de la categoría
    (`src/lib/milestoneCategory.ts`, tabla de búsqueda literal —
    mismo motivo que `category.ts` para las clases de Tailwind) se ve
    como insignia sobre la miniatura, y ocupa el sitio de la foto
    cuando no hay ninguna, en vez del icono de estrella genérico de
    antes.
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

En producción ([pequedex.pages.dev](https://pequedex.pages.dev)): Cloudflare
Pages con framework preset "Vue" (`npm run build`, output `dist`), **Root
directory = `web`** (repo raíz es un monorepo con `api/` al lado). Variable
de entorno de build `VITE_API_URL` apuntando a la API real en Render.
Vue Router va en modo `history` (URLs sin `#`) pero **no hace falta un
`_redirects` con `/* /index.html 200`**: Cloudflare Pages sirve `index.html`
como *fallback* de SPA automáticamente para cualquier ruta sin archivo
estático que coincida — un `_redirects` explícito con ese patrón, de
hecho, dispara un aviso de "bucle infinito" en el build (fue probado y
retirado). Auto-deploy nativo de Cloudflare Pages sí queda activo (a
diferencia de la API en Render): aquí no hay el problema de webhook
perdido que forzó el *deploy hook* vía GitHub Actions en el lado de la API.
