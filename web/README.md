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
npm run format         # Prettier
npm run test:unit      # Vitest
```

## Estructura relevante

- `src/lib/api.ts` — instancia de axios con interceptor que añade el token
  Bearer a cada petición, y cierra sesión automáticamente ante un 401.
- `src/stores/auth.ts` — sesión (usuario + token), registro/login/logout, y
  restauración de sesión al recargar la página.
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
  las listas de crecimiento e hitos. Sondea `/timeline` cada 5 segundos
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
  frontend.

## Idioma

`src/i18n.ts` configura `vue-i18n` con español (por defecto) e inglés —
ver la nota de arquitectura en el README raíz sobre por qué solo estos
dos, a diferencia de los 5 idiomas de LudoDex/MIRA. `LanguageSwitcher.vue`
vive en `App.vue` (visible en cualquier pantalla, incluidas login/
register) y persiste la elección en `localStorage` bajo la clave
`pequedex_locale`. Los mensajes viven en `src/locales/{es,en}.ts`; los
valores de los enums del backend (`izquierdo`/`derecho`/`ambos`,
`mojado`/`sucio`/`ambos`) se traducen en el punto de uso — son valores
internos en español, no texto de interfaz.

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
  desplegables.
- **`PasswordField.vue`** — todos los campos de contraseña (login,
  registro y su confirmación) llevan el icono de ojo para mostrar/
  ocultar, no solo el de login.
- **`EntryCard.vue` / `CategoryIcon.vue` / `src/lib/category.ts`** —
  la tarjeta compartida por línea temporal, crecimiento e hitos, con su
  franja de color por categoría. Las clases de Tailwind por categoría
  (`text-feed`, `bg-feed/15`, …) están en `category.ts` como tablas de
  búsqueda literales, no interpoladas (`` `text-${category}` ``): el
  escáner de Tailwind solo detecta nombres de clase que aparecen tal
  cual en el código fuente.

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
regenerar el código de invitación, crear o unirse a un bebé — no en los
registros rápidos, donde la propia hoja cerrándose y la entrada
apareciendo en su lista ya es confirmación suficiente.

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
