import { nextTick } from 'vue'
import { START_LOCATION, type Router } from 'vue-router'

// Transición entre pantallas con la API View Transitions del navegador: hace una
// foto de la pantalla que sale, Vue cambia la vista y el navegador funde la foto
// con la nueva (estilos en assets/base.css, `::view-transition-*`). Va aquí y no
// con un <Transition> de Vue en el RouterView: ese dejaba vistas antiguas montadas
// (ver el comentario de App.vue). Aquí Vue desmonta la vista anterior en el acto;
// lo que se anima es una captura, no la vista vieja.
//
// Sin la API (Firefox antiguo, Safari < 18), con movimiento reducido, en la primera
// carga o si solo cambia la query (los atajos `?atajo=`), la navegación es normal.

type StartViewTransition = (update: () => Promise<void>) => unknown

interface Env {
  startViewTransition?: StartViewTransition
  prefersReducedMotion: () => boolean
}

function browserEnv(): Env {
  const doc = typeof document === 'undefined' ? undefined : document
  return {
    startViewTransition: doc?.startViewTransition?.bind(doc) as StartViewTransition | undefined,
    prefersReducedMotion: () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

export function installViewTransitions(router: Router, env: Env = browserEnv()): void {
  const start = env.startViewTransition
  if (!start) return

  // Lo que deja terminar la transición en curso: se llama cuando Vue ya pintó la
  // vista nueva (o si la navegación no se completa).
  let finish: (() => void) | null = null

  router.beforeResolve((to, from) => {
    if (from === START_LOCATION || to.path === from.path || env.prefersReducedMotion()) return
    return new Promise<void>((resolve) => {
      start(
        () =>
          new Promise<void>((done) => {
            finish = done
            resolve()
          }),
      )
    })
  })

  // `afterEach` se llama también si la navegación falla o se cancela: la
  // transición nunca se queda esperando (el navegador congela la pantalla mientras).
  router.afterEach(async () => {
    if (!finish) return
    const done = finish
    finish = null
    await nextTick()
    done()
  })
}
