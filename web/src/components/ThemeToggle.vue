<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyTheme, getStoredTheme, storeTheme } from '@/theme'
import { useFeedback } from '@/composables/useFeedback'

const { t } = useI18n()
const feedback = useFeedback()

const isDark = ref(resolvesToDark())

function resolvesToDark(): boolean {
  const stored = getStoredTheme()
  if (stored === 'light') return false
  if (stored === 'dark') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function switchTheme() {
  const next = isDark.value ? 'light' : 'dark'
  storeTheme(next)
  applyTheme(next)
  isDark.value = next === 'dark'
}

// Calienta la maquinaria interna de la View Transitions API con una
// transición vacía (sin ningún cambio visual) nada más montar el
// interruptor, no en el primer toggle real. Diagnóstico en vivo con un
// vídeo del móvil: el primer barrido de verdad se quedaba pillado un buen
// rato (como si el tema aún no estuviera disponible) antes de arrancar,
// y los siguientes iban bien - la propia API tiene que crear sus capas de
// composición internas la primera vez que se usa en la página, un coste
// que solo se paga una vez. Disparándolo aquí, en segundo plano al cargar
// y sin ningún cambio visible (`() => {}` no toca el DOM), ese coste ya
// está pagado para cuando el usuario pulsa el botón de verdad.
// requestIdleCallback (con setTimeout como alternativa en Safari, que no
// lo implementa) para no competir con la carga inicial de la página.
let warmedUp = false
function warmUpViewTransitions() {
  if (warmedUp || !document.startViewTransition) return
  warmedUp = true

  const run = () => void document.startViewTransition!(() => {}).ready.catch(() => {})
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2000 })
  } else {
    setTimeout(run, 500)
  }
}

onMounted(warmUpViewTransitions)

// Barrido circular "amanecer/atardecer" desde el propio botón, en vez de un
// cambio de tema instantáneo - View Transitions API (Chrome/Edge, Safari
// 18+; en el resto simplemente cae al cambio instantáneo de siempre, ver
// más abajo). El navegador captura una foto del estado viejo y nuevo y nos
// deja animar el recorte circular entre ambas con la Web Animations API -
// receta estándar de la propia spec (ver
// https://developer.chrome.com/docs/web-platform/view-transitions), con dos
// diferencias:
// 1. Siempre se anima `::view-transition-new(root)` creciendo desde 0 en
//    el centro del botón hacia fuera, en las dos direcciones (claro→oscuro
//    y oscuro→claro), no solo una.
// 2. Las coordenadas del centro se expresan en `vw`/`vh`, no en píxeles
//    sueltos - estas unidades se resuelven siempre contra el viewport CSS
//    real, con independencia del tamaño que el navegador le dé por dentro
//    al árbol de pseudo-elementos de la transición (donde se vio el otro
//    síntoma del mismo vídeo: el círculo nacía desplazado hacia arriba del
//    botón en una pestaña normal de móvil).
//
// El color del halo no se elige a mano: es literalmente la captura del
// tema hacia el que se cambia asomando por el círculo, así que al pasar a
// oscuro el halo ya sale oscuro y al pasar a claro, claro, sin más lógica.
function toggle(event: MouseEvent) {
  feedback.theme()

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reducedMotion) {
    switchTheme()
    return
  }

  const button = event.currentTarget as HTMLElement
  const transition = document.startViewTransition(switchTheme)

  void transition.ready
    .then(() => {
      const rect = button.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const x = `${(centerX / window.innerWidth) * 100}vw`
      const y = `${(centerY / window.innerHeight) * 100}vh`
      const endRadius = Math.hypot(
        Math.max(centerX, window.innerWidth - centerX),
        Math.max(centerY, window.innerHeight - centerY),
      )

      // La clase que desactiva el cross-fade por defecto (ver base.css) solo
      // se añade aquí, justo antes de animar el recorte propio - no de
      // forma permanente - para que, si `ready` llega a rechazar más abajo
      // (la propia API puede abortar la transición si algo más pinta
      // entremedias), el navegador conserve su cross-fade por defecto como
      // respaldo en vez de quedarse con la pantalla vieja congelada sin
      // ninguna animación.
      document.documentElement.classList.add('theme-sweep-active')
      const sweep = document.documentElement.animate(
        { clipPath: [`circle(0px at ${x} ${y})`, `circle(${endRadius}px at ${x} ${y})`] },
        { duration: 500, easing: 'ease-in', pseudoElement: '::view-transition-new(root)' },
      )
      void sweep.finished
        .catch(() => {})
        .then(() => document.documentElement.classList.remove('theme-sweep-active'))
    })
    .catch(() => {
      // Transición abortada por el navegador antes de poder animar nuestro
      // círculo - el tema ya ha cambiado (switchTheme() se ejecutó de forma
      // síncrona dentro de startViewTransition), simplemente no hay barrido
      // esta vez; sin theme-sweep-active, el cross-fade por defecto ya
      // habrá hecho su parte.
    })
}
</script>

<template>
  <button
    type="button"
    class="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-text-muted"
    :aria-label="t('common.toggleTheme')"
    :aria-pressed="isDark"
    @click="toggle($event)"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-[1.05rem] w-[1.05rem]"
    >
      <!-- Shows the mode a click leads to, not the current one - in dark
      mode the button switches to light, so it shows the sun (and vice
      versa), same convention as LudoDex/MIRA MarketLens's toggle. -->
      <template v-if="isDark">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        />
      </template>
      <path v-else d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  </button>
</template>
