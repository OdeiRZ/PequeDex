// Sincronización en segundo plano de lo pendiente (la cola de lib/offlineQueue.ts)
// y "calentamiento" de la API. Vive a nivel de TODA la app, no de una pantalla:
// antes solo se enviaba con la pantalla de inicio abierta.
//
// Qué resuelve, medido con e2e/reconnect.spec.ts (red colgada que vuelve):
//  - `navigator.onLine` miente (wifi sin internet sigue en "true" y no avisa al
//    volver), así que no se puede esperar al evento `online`: se reintenta con
//    esperas CORTAS (2, 3 y luego 5 s) mientras haya algo pendiente.
//  - Antes de enviar se hace una sonda ligera (`/up`, 3 s): con la API dormida
//    o la red muerta no se lanza un envío que se cuelga 20 s.
//  - Al volver la app a primer plano o la conexión, se corta el envío que seguía
//    colgado en la conexión antigua y se reintenta AL INSTANTE.

import { apiClient } from '@/lib/api'

/** Esperas entre reintentos mientras algo sigue pendiente; la última se repite. */
export const RETRY_DELAYS_MS = [2_000, 3_000, 5_000]

/** Un envío sin respuesta tras este tiempo se da por colgado (ver abortStuck). */
export const STUCK_AFTER_MS = 5_000

/** Cuánto espera la sonda antes de darse por "sin servidor". */
export const PROBE_TIMEOUT_MS = 3_000

/** Tras tanto tiempo con la app oculta, al volver se vuelve a despertar la API
 * (Render la duerme a los ~15 min sin tráfico). */
export const REWARM_AFTER_HIDDEN_MS = 5 * 60_000

/** La raíz del servidor: `/up` está fuera de `/api`. */
function serverRoot(): string {
  const base = apiClient.defaults.baseURL ?? ''
  return base.replace(/\/api\/?$/, '')
}

/** ¿Contesta el servidor? Cualquier respuesta HTTP vale (aunque sea un error):
 * lo que importa es que haya alguien al otro lado. `no-cors` evita la petición
 * previa de CORS y deja la respuesta opaca, que es suficiente. */
export async function probeServer(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(`${serverRoot()}/up`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Despierta la API sin esperar la respuesta: al abrir la app, Render ya está
 * arrancando mientras la persona toca la pantalla, en vez de empezar cuando se
 * hace el primer envío. */
export function warmUpApi(): void {
  void fetch(`${serverRoot()}/up`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
}

export interface BackgroundSyncDeps {
  /** Registros pendientes de enviar ahora mismo. */
  pendingCount: () => number
  /** Envía la cola; devuelve cuántos se enviaron. Si ya hay un envío en curso, se une a él. */
  flush: () => Promise<{ sent: number }>
  /** Corta las peticiones del envío en curso (siguen en la cola), si llevan al
   * menos `minAgeMs` en marcha (0 = siempre). */
  abortStuck: (minAgeMs?: number) => void
  /** Sonda de conectividad (por defecto, probeServer). */
  probe?: () => Promise<boolean>
  /** Se llama tras un envío que mandó algo. */
  onSent?: (count: number) => void
}

export interface BackgroundSync {
  /** Hay algo nuevo en la cola: asegura que se intentará enviar. */
  notifyPending: () => void
  /** La conexión o la app vuelven: corta lo colgado y reintenta ya. */
  retryNow: () => void
  /** Para todo y quita los listeners. */
  stop: () => void
}

export function startBackgroundSync(deps: BackgroundSyncDeps): BackgroundSync {
  const probe = deps.probe ?? probeServer
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let stopped = false
  let hiddenAt: number | null = null
  // Cada `retryNow` abre una "generación" nueva: un ciclo que se quedó colgado
  // en la conexión antigua (la sonda o el envío) ya no cuenta y no estorba al
  // nuevo.
  let generation = 0
  let running = 0

  function schedule() {
    if (stopped || timer !== undefined || deps.pendingCount() === 0) return
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!
    attempt++
    timer = setTimeout(() => {
      timer = undefined
      void cycle()
    }, delay)
  }

  async function cycle() {
    if (stopped || deps.pendingCount() === 0) return
    const mine = generation
    // Un ciclo de esta misma generación ya está en marcha: no se solapan.
    if (running > 0 && running === mine + 1) return
    running = mine + 1
    try {
      if (await probe()) {
        if (mine !== generation) return
        // El servidor contesta ahora: un envío que lleva rato sin respuesta se
        // quedó colgado en una conexión que ya no existe. Se corta y se reenvía,
        // en vez de esperar a que agote sus 20 s. Uno reciente puede ser solo
        // lento: se deja.
        deps.abortStuck(STUCK_AFTER_MS)
        const { sent } = await deps.flush()
        if (mine !== generation) return
        if (sent > 0) deps.onSent?.(sent)
        if (deps.pendingCount() === 0) attempt = 0
      }
    } catch {
      // Lo que falle aquí se reintenta en la siguiente vuelta.
    } finally {
      if (mine === generation) {
        running = 0
        schedule()
      }
    }
  }

  function retryNow() {
    if (stopped) return
    deps.abortStuck()
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    attempt = 0
    generation++
    running = 0
    void cycle()
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt > REWARM_AFTER_HIDDEN_MS) warmUpApi()
    hiddenAt = null
    retryNow()
  }

  const onBack = () => retryNow()
  window.addEventListener('online', onBack)
  window.addEventListener('focus', onBack)
  window.addEventListener('pageshow', onBack)
  document.addEventListener('visibilitychange', onVisibility)

  // Al arrancar puede haber cola de una sesión anterior.
  void cycle()

  return {
    notifyPending: () => schedule(),
    retryNow,
    stop() {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener('online', onBack)
      window.removeEventListener('focus', onBack)
      window.removeEventListener('pageshow', onBack)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
