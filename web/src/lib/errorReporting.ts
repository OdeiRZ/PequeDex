import type { App } from 'vue'
import type { ErrorEvent, EventHint } from '@sentry/vue'

// Reporte de errores del frontend a Sentry. Solo se activa si el build lleva
// `VITE_SENTRY_DSN` (el DSN es público por diseño: no es un secreto); sin él,
// no se descarga ni se ejecuta nada. El SDK se carga con `import()` DESPUÉS de
// montar la app, así que no pesa en el arranque.
//
// Privacidad: es un diario de bebé. No se manda ningún dato personal
// (`sendDefaultPii: false`), no hay sesiones grabadas ni trazas, y se quitan
// los avisos de consola y de clics (el texto de un botón puede ser el nombre
// de un bebé). Lo que sí llega: el mensaje y la pila del error, la ruta y la
// versión de la app.

/** Errores que no son fallos de la app: sin red, tiempo agotado, peticiones
 * canceladas. Son el día a día de un móvil y de la API gratuita que se duerme
 * (la app ya los trata: cola sin conexión), y llenarían Sentry de ruido. */
const NOISE_MESSAGES = [
  'Network Error',
  'Request aborted',
  'canceled',
  /^timeout of \d+ms exceeded$/,
  'Load failed',
  'Failed to fetch',
  // El navegador avisa de esto cuando una animación de ResizeObserver no cabe
  // en un fotograma; es inofensivo.
  'ResizeObserver loop',
]

function isNoise(message: string): boolean {
  return NOISE_MESSAGES.some((noise) =>
    typeof noise === 'string' ? message.includes(noise) : noise.test(message),
  )
}

/** Última barrera antes de enviar: descarta el ruido y deja el evento sin
 * datos de usuario ni parámetros de la URL. Es una función pura para poder
 * probarla sin cargar Sentry. */
export function filterEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  const original = hint?.originalException
  const message =
    original instanceof Error
      ? original.message
      : (event.exception?.values?.[0]?.value ?? event.message ?? '')

  // Un error de axios con respuesta (4xx/5xx) sí es interesante; sin respuesta
  // es un fallo de red, ya cubierto arriba por el mensaje.
  if (isNoise(message)) return null

  delete event.user
  if (event.request?.url) event.request.url = event.request.url.split('?')[0]!
  if (event.request) {
    delete event.request.cookies
    delete event.request.query_string
  }

  return event
}

export async function initErrorReporting(app: App): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/vue')

    Sentry.init({
      app,
      dsn,
      release: import.meta.env.VITE_APP_RELEASE || undefined,
      environment: import.meta.env.MODE,
      // Qué datos puede recoger el SDK: ninguno de los personales (usuario,
      // cookies, cabeceras, cuerpos de peticiones, parámetros de la URL).
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      // Sin trazas de rendimiento ni grabación de sesiones: solo errores.
      tracesSampleRate: 0,
      // Sin avisos de clics (el texto de un botón puede ser el nombre de un
      // bebé) ni de consola.
      integrations: [Sentry.breadcrumbsIntegration({ dom: false })],
      beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
      beforeSend: filterEvent,
    })
  } catch {
    // Si el SDK no carga (sin red, bloqueador de anuncios), la app sigue igual.
  }
}
