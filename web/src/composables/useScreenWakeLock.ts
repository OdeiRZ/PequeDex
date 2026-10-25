import { onUnmounted, watch } from 'vue'

// Mantiene la pantalla encendida mientras `active()` sea verdadero (Screen Wake
// Lock API). Pensado para Contracciones: durante el parto se pulsa empezar y
// terminar cada pocos minutos, y si el móvil se bloquea entre una y otra hay que
// desbloquearlo cada vez.
//
// El navegador suelta el bloqueo él solo cuando la pestaña deja de verse (otra
// app, pantalla apagada a mano), así que al volver se pide de nuevo. Sin la API
// (Firefox, Safari < 16.4) o si el navegador lo deniega (batería baja), no pasa
// nada: la pantalla se comporta como siempre.

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

function browserWakeLock(): WakeLockLike | undefined {
  return typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
}

export function useScreenWakeLock(
  active: () => boolean,
  wakeLock: WakeLockLike | undefined = browserWakeLock(),
) {
  let sentinel: WakeLockSentinelLike | null = null
  let requesting = false

  async function acquire() {
    if (!wakeLock || requesting || (sentinel && !sentinel.released)) return
    if (document.visibilityState !== 'visible') return
    requesting = true
    try {
      sentinel = await wakeLock.request('screen')
      // Si mientras tanto dejó de hacer falta (contracción terminada y pausa
      // larga, salir de la pantalla), se suelta en el acto.
      if (!active()) await release()
    } catch {
      sentinel = null
    } finally {
      requesting = false
    }
  }

  async function release() {
    const current = sentinel
    sentinel = null
    if (current && !current.released) {
      try {
        await current.release()
      } catch {
        // ya estaba suelto
      }
    }
  }

  function sync() {
    if (active()) void acquire()
    else void release()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') sync()
  }

  const stop = watch(active, sync, { immediate: true })
  document.addEventListener('visibilitychange', onVisibilityChange)

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void release()
  })
}
