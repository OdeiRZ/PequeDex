/* eslint-env serviceworker */
/* global self, caches, fetch, Request, Response, URL */

// Service worker de PequeDex. NO se sirve tal cual: el plugin de Vite
// (vite.sw.ts) lo toma como plantilla en el build, sustituye los dos
// marcadores de abajo y lo emite como `sw.js`.
//
// Qué hace: guarda en el dispositivo los ficheros de la app (el "armazón") al
// instalarse, para poder abrirla sin conexión. Qué NO hace, a propósito:
//   - No toca el API ni ninguna petición de otro origen (salvo las fuentes de
//     Google): los datos siempre van a la red; sin conexión ya los cubren la
//     foto guardada y la cola de registros (ver "Registro sin conexión").
//   - No toca los audios (peticiones con rango): se sirven de la red.
//   - No se activa solo cuando hay una versión nueva: queda "esperando" y la app
//     avisa; se activa cuando la persona pulsa Actualizar (mensaje SKIP_WAITING).
//     Así nunca se mezclan los ficheros de dos versiones.
//
// Si algún día hay que quitarlo de golpe: publicar un sw.js que haga
// `self.registration.unregister()` y borre las cachés `pequedex-*`.

const VERSION = '__SW_VERSION__'
const PRECACHE = __PRECACHE_MANIFEST__

const SHELL_PREFIX = 'pequedex-shell-'
const SHELL_CACHE = `${SHELL_PREFIX}${VERSION}`
// La caché de las fuentes de Google de versiones anteriores: la fuente ya va con la
// app (assets/), así que se borra al activarse.
const LEGACY_FONT_CACHE = 'pequedex-fonts-v1'

// Dirección base donde está registrado (p. ej. https://odeirz.github.io/PequeDex/).
const SCOPE = self.registration.scope
const INDEX_URL = new URL('./', SCOPE).href
const SOUNDS_PATH = new URL('sounds/', SCOPE).pathname

// Los ficheros guardados se identifican por su URL (los de la app llevan el hash
// en el nombre), así que la coincidencia debe ignorar la cabecera `Vary`. Sin
// esto, un servidor que responde `Vary: Origin` (como `vite preview`) hacía que
// un mismo JS se encontrase o no según la petición llevase `Origin` o no
// (precarga de módulos vs. <script>): la app fallaba sin conexión de forma
// intermitente. Lo cazó el e2e de "abrir sin conexión".
const MATCH_OPTIONS = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      // Todo o nada: si falla un solo fichero, la instalación falla y se queda la
      // versión anterior (mejor que una app a medias). `cache: 'reload'` salta la
      // caché HTTP (GitHub Pages cachea 10 minutos): un index.html viejo apuntaría
      // a ficheros que ya no existen.
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, SCOPE).href
          const response = await fetch(new Request(url, { cache: 'reload' }))
          if (!response.ok) throw new Error(`No se pudo guardar ${url}: ${response.status}`)
          await cache.put(url, response)
        }),
      )
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borra el armazón de versiones anteriores y la caché de fuentes antigua.
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(
            (name) =>
              (name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE) || name === LEGACY_FONT_CACHE,
          )
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // El API y cualquier otro origen: red normal, sin pasar por aquí.
  if (url.origin !== self.location.origin) return
  if (!url.href.startsWith(SCOPE)) return
  // Audio: se pide por rangos y es enorme; no se cachea aquí.
  if (request.headers.has('range') || url.pathname.startsWith(SOUNDS_PATH)) return

  if (request.mode === 'navigate' && isPage(url)) {
    event.respondWith(shellForNavigation(request))
    return
  }

  event.respondWith(cacheFirst(request))
})

// Una "página" de la SPA es una ruta sin extensión: /, /estadisticas, /vacunas...
// (un enlace directo a /manifest.webmanifest o a un .js no debe devolver el index).
function isPage(url) {
  const last = url.pathname.split('/').pop() || ''
  return !last.includes('.')
}

// Cualquier ruta de la app se resuelve con el mismo index.html guardado: el
// router de la SPA pinta la pantalla. Sin él guardado (instalación a medias),
// red normal.
async function shellForNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  const shell = await cache.match(INDEX_URL, MATCH_OPTIONS)
  if (shell) return shell
  return fetch(request)
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request, MATCH_OPTIONS)
  if (cached) return cached

  const response = await fetch(request)
  // Un fichero con hash que no estaba en la lista (poco probable): se guarda al vuelo.
  if (response.ok && new URL(request.url).pathname.includes('/assets/')) {
    await cache.put(request, response.clone())
  }
  return response
}
