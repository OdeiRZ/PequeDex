import { ref } from 'vue'

// Registro del service worker (ver sw/sw.template.js) y aviso de versión nueva.
//
// Solo en el build de producción: en desarrollo, un service worker guardando
// ficheros es una fuente constante de "no veo mis cambios".

/** Hay una versión nueva instalada y esperando a que la persona la acepte. */
export const updateAvailable = ref(false)

let registration: ServiceWorkerRegistration | undefined
let applying = false

// Con la app en primer plano no se navega, así que el navegador casi no
// comprobaría versiones nuevas: se pregunta al volver a ella, como mucho cada
// MIN_CHECK_INTERVAL_MS.
const MIN_CHECK_INTERVAL_MS = 30 * 60_000
let lastCheck = Date.now()

function watchInstalling(worker: ServiceWorker | null) {
  if (!worker) return
  worker.addEventListener('statechange', () => {
    // "installed" con un service worker ya controlando la página = es una
    // actualización (la primera instalación no hay que avisarla).
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      updateAvailable.value = true
    }
  })
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Recargar cuando el nuevo service worker toma el control, pero SOLO si ha sido
  // por pulsar "Actualizar": en la primera visita también ocurre (clients.claim()) y
  // recargar entonces sería un parpadeo inútil.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) window.location.reload()
  })

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    } catch {
      return // sin service worker la app funciona igual, solo sin abrirse sin conexión
    }

    if (registration.waiting && navigator.serviceWorker.controller) updateAvailable.value = true
    watchInstalling(registration.installing)
    registration.addEventListener('updatefound', () => watchInstalling(registration!.installing))

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastCheck < MIN_CHECK_INTERVAL_MS) return
      lastCheck = Date.now()
      registration?.update().catch(() => {})
    })
  })
}

/** Activa la versión nueva (la página se recarga sola al cambiar el control). */
export function applyUpdate(): void {
  applying = true
  const waiting = registration?.waiting
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' })
  else window.location.reload()
}
