<script setup lang="ts">
import { ref } from 'vue'
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

// Barrido circular "amanecer/atardecer" desde el propio botón, en vez de un
// cambio de tema instantáneo.
//
// Tres intentos anteriores usaron la View Transitions API (recorte
// circular de `::view-transition-new(root)` vía Web Animations API,
// primero en píxeles, luego en vw/vh, con una transición de calentamiento
// de por medio para el retraso) y, probados en Android real, siguieron
// naciendo desplazados del botón en una pestaña normal (fuera de la PWA
// instalada a pantalla completa) en los tres casos - la propia API decide
// por dentro el tamaño del árbol de pseudo-elementos que recorta, y ese
// tamaño no coincidía con el viewport real en ese dispositivo por una
// razón que no se pudo aislar con certeza pese a varios diagnósticos en
// vivo (vídeo + capturas de pantalla).
//
// Esta versión no usa la View Transitions API en absoluto, así que no hay
// nada que recortar en un sistema de coordenadas ajeno: se recorta
// directamente el `<body>` de verdad (mismo `getBoundingClientRect()` que
// ya usa el propio botón para saber dónde está - cero ambigüedad posible)
// y el cambio de tema ya se ha aplicado por debajo antes de empezar a
// animar, así que lo que crece dentro del círculo es la interfaz nueva de
// verdad, en vivo e interactiva, no una foto congelada - y al no haber
// ninguna captura de pantalla de por medio tampoco hay ningún retraso que
// calentar. Lo único que se simula es el fondo que queda fuera del
// círculo mientras crece: el color plano del tema viejo (`--surface-sunken`,
// leído antes del cambio) puesto en el `<html>` que queda al descubierto
// donde `<body>` está recortado - se pierde el degradado decorativo de esa
// zona por el instante que dura el barrido, pero es la zona que se está
// dejando atrás, no la que crece.
function toggle(event: MouseEvent) {
  feedback.theme()

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  if (reducedMotion || typeof document.body.animate !== 'function') {
    switchTheme()
    return
  }

  const html = document.documentElement
  const oldSurfaceSunken = getComputedStyle(html).getPropertyValue('--surface-sunken').trim()
  const previousHtmlBackground = html.style.background

  switchTheme()
  html.style.background = oldSurfaceSunken

  const sweep = document.body.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
    { duration: 500, easing: 'ease-in' },
  )

  void sweep.finished
    .catch(() => {})
    .then(() => {
      html.style.background = previousHtmlBackground
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
