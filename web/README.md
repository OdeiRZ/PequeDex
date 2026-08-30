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
- `src/views/{Login,Register}View.vue` — formularios mínimos sin diseño
  todavía; funcionales y probados de punta a punta contra la API real,
  pendientes de la identidad visual del proyecto.
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
  con mucha menos frecuencia que tomas/sueño/pañales).

## Sin idiomas ni diseño todavía

A diferencia de LudoDex/MIRA, esta SPA no usa `vue-i18n` (ver la nota de
arquitectura en el README raíz) ni tiene paleta/tipografía propia
definida — ambas cosas se añadirán cuando haga falta, con las pantallas
principales ya cerradas y probadas, no como infraestructura previa sin
pantallas reales detrás.
