<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyTheme, getStoredTheme, storeTheme, THEME_COLOR } from '@/theme'
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
// Dos intentos anteriores usaron la View Transitions API (recorte circular
// de `::view-transition-new(root)` vía Web Animations API) y, probados en
// Android real, resultaron frágiles de dos formas distintas: 1) la API
// tiene que capturar una foto de toda la pantalla por dentro antes de poder
// animar nada, lo que a veces introducía un retraso perceptible donde no
// pasaba nada en absoluto antes del barrido; 2) las coordenadas del centro
// (tanto en píxeles como en vw/vh) no siempre coincidían con las del propio
// botón - el círculo nacía desplazado hacia arriba en una pestaña normal
// de móvil, sin que lograra aislar ni arreglar la causa exacta con certeza
// en dos rondas de cambios.
//
// Esta versión no usa la View Transitions API en absoluto: un <div> normal
// con `clip-path`, sin ninguna captura de pantalla de por medio, usa
// exactamente el mismo sistema de coordenadas que `getBoundingClientRect()`
// del propio botón - cero ambigüedad posible sobre dónde nace el círculo -
// y es instantáneo (solo crea un elemento y lo anima, nada que capturar).
// El círculo es del color sólido del tema AL QUE SE VA (`THEME_COLOR`, el
// mismo origen que ya usa theme.ts para `theme-color-override`) y crece
// desde el botón hasta cubrir toda la pantalla; el cambio de tema real se
// aplica justo al terminar, cuando el círculo ya la cubre entera, así que
// el "cambio" por debajo es invisible.
function toggle(event: MouseEvent) {
  feedback.theme()

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    switchTheme()
    return
  }

  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const nextTheme = isDark.value ? 'light' : 'dark'
  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;pointer-events:none;background:${THEME_COLOR[nextTheme]}`
  document.body.appendChild(overlay)

  const sweep = overlay.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
    { duration: 500, easing: 'ease-in' },
  )

  void sweep.finished
    .catch(() => {})
    .then(() => {
      switchTheme()
      overlay.remove()
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
