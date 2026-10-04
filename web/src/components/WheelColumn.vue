<script setup lang="ts" generic="T extends string | number">
import { onMounted, ref, watch } from 'vue'
import { useFeedback } from '@/composables/useFeedback'

// Same scroll-snap "wheel" feel as a native iOS/Android date picker, built
// from a plain scrollable div instead of a library - BabyOnboardingWizard
// is the only place that needs one, three times over (day/month/year), so
// this stays generic over the item type rather than hardcoding dates.
const props = defineProps<{
  items: { value: T; label: string }[]
  modelValue: T
  ariaLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const feedback = useFeedback()

const ITEM_HEIGHT = 40
const VISIBLE_ROWS = 3
// One row above, one below the centered/selected row.
const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2)
// How long to wait after the last scroll event before treating the
// centered item as the new selection - scroll events fire continuously
// while flicking/dragging, this is what turns that into a single commit
// once it actually settles.
const SETTLE_DELAY_MS = 120

const scroller = ref<HTMLElement | null>(null)
let settleTimeout: number | undefined
// Distinguishes a scroll caused by scrollToIndex() (programmatic, e.g. the
// parent resetting modelValue) from one caused by the user's own
// finger/wheel - without this, snapping to a new value from outside would
// immediately re-fire onScroll and could echo a stale index back out.
let programmaticScroll = false

function indexOfValue(value: T): number {
  const index = props.items.findIndex((item) => item.value === value)
  return index === -1 ? 0 : index
}

function nearestIndex(): number {
  if (!scroller.value) return 0
  return Math.min(
    props.items.length - 1,
    Math.max(0, Math.round(scroller.value.scrollTop / ITEM_HEIGHT)),
  )
}

// Qué fila sonó el último "tick" - para disparar uno nuevo solo al cruzar a
// una fila distinta, no en cada evento scroll (que dispara de sobra
// mientras el dedo sigue dentro de la misma fila). Sincronizado también en
// cada scrollToIndex() programático (montaje, click, reset externo), para
// que el primer deslizamiento del usuario después de uno de esos saltos no
// compare contra una fila ya vieja y dispare un tick de más.
let lastTickIndex = -1

// Qué fila está centrada AHORA MISMO - a diferencia de `modelValue`, que
// solo se actualiza al asentarse el scroll (ver SETTLE_DELAY_MS más
// abajo), esto se mueve en tiempo real mientras el dedo sigue deslizando.
// Marca visualmente esa fila (ver `.wheel-item-active` en el CSS) para que
// quede claro cuál es el valor elegido sin depender solo de la banda
// posicional del centro - reportado en vivo: en una rueda de día, con
// etiquetas como "Hoy"/"Ayer", el texto ya deja claro cuál está activa,
// pero en una de hora/minuto (solo dos dígitos) no había ninguna diferencia
// visual entre la fila central y el resto.
const liveIndex = ref(indexOfValue(props.modelValue))

function scrollToIndex(index: number, smooth: boolean) {
  const el = scroller.value
  if (!el) return

  lastTickIndex = index
  liveIndex.value = index
  programmaticScroll = true
  el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' })

  if (!smooth) {
    programmaticScroll = false
    return
  }

  // Esperar al evento real `scrollend`, no a un temporizador fijo - un
  // salto largo (p.ej. de la fecha de nacimiento del bebé hasta hoy, al
  // abrir "+ Sueño" tras haber editado antes algo cercano al
  // nacimiento) tarda más que un salto de una sola fila, y un timeout
  // fijo demasiado corto reactivaba `onScroll()` a mitad de la
  // animación: los eventos de scroll que aún quedaban por disparar se
  // trataban entonces como un gesto real del usuario, y el valor que
  // quedaba seleccionado al asentarse (`SETTLE_DELAY_MS` después) era
  // el día por el que iba pasando la animación en ese momento, no el de
  // destino - de ahí que pareciera "irse" al nacimiento en vez de a
  // hoy. El timeout de reserva (1000ms) es solo para navegadores sin
  // soporte de `scrollend` (Safari < 17.4), no una duración estimada.
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    programmaticScroll = false
    el.removeEventListener('scrollend', finish)
  }
  el.addEventListener('scrollend', finish, { once: true })
  window.setTimeout(finish, 1000)
}

onMounted(() => {
  scrollToIndex(indexOfValue(props.modelValue), false)
})

watch(
  () => props.modelValue,
  (value) => {
    const targetIndex = indexOfValue(value)
    const currentIndex = scroller.value ? Math.round(scroller.value.scrollTop / ITEM_HEIGHT) : -1

    if (targetIndex !== currentIndex) scrollToIndex(targetIndex, true)
  },
)

// Scrolling is the primary gesture (matches a native date wheel), but a
// mouse has no equivalent flick - without this, a desktop user could only
// nudge the wheel with the scroll wheel/trackpad and had no way to jump
// straight to a specific visible value.
function selectIndex(index: number) {
  const item = props.items[index]
  if (!item) return

  scrollToIndex(index, true)
  if (item.value !== props.modelValue) emit('update:modelValue', item.value)
}

function onScroll() {
  if (programmaticScroll) return

  const index = nearestIndex()
  liveIndex.value = index

  // El "clic" del dial, uno por fila cruzada - independiente del commit de
  // abajo (que solo emite al asentarse): el usuario tiene que notar cada
  // valor por el que pasa el dedo mientras aún sigue deslizando, no solo
  // el que queda seleccionado al soltar.
  if (index !== lastTickIndex) {
    lastTickIndex = index
    feedback.tick()
  }

  window.clearTimeout(settleTimeout)
  settleTimeout = window.setTimeout(() => {
    const item = props.items[index]
    if (item && item.value !== props.modelValue) emit('update:modelValue', item.value)
  }, SETTLE_DELAY_MS)
}
</script>

<template>
  <div
    ref="scroller"
    class="wheel-column"
    role="listbox"
    :aria-label="ariaLabel"
    :style="{ height: `${ITEM_HEIGHT * VISIBLE_ROWS}px` }"
    @scroll="onScroll"
  >
    <div class="wheel-pad" :style="{ height: `${ITEM_HEIGHT * PAD_ROWS}px` }" />
    <div
      v-for="(item, i) in items"
      :key="item.value"
      class="wheel-item"
      :class="{ 'wheel-item-active': i === liveIndex }"
      role="option"
      :aria-selected="item.value === modelValue"
      :style="{ height: `${ITEM_HEIGHT}px` }"
      @click="selectIndex(i)"
    >
      {{ item.label }}
    </div>
    <div class="wheel-pad" :style="{ height: `${ITEM_HEIGHT * PAD_ROWS}px` }" />
  </div>
</template>

<style scoped>
.wheel-column {
  position: relative;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  border-radius: 0.85rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  scrollbar-width: none;
}

.wheel-column::-webkit-scrollbar {
  display: none;
}

.wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  cursor: pointer;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-muted);
  transition: color 0.1s ease;
}

/* La fila centrada de verdad (ver `liveIndex`), no solo la banda de
   fondo - un número suelto (hora/minuto) no se lee como "elegido" solo
   por estar dentro de un recuadro, hace falta que el propio texto
   destaque. */
.wheel-item-active {
  color: var(--color-brand);
  font-weight: 700;
}

/* Fixed highlighted band in the middle row - always shows where the
   selection will land once scrolling settles, independent of the actual
   committed value (which only updates after SETTLE_DELAY_MS), so the
   picker reads correctly even mid-drag. */
.wheel-column::before {
  content: '';
  position: absolute;
  top: 40px;
  left: 0;
  right: 0;
  height: 40px;
  border-top: 2px solid var(--color-brand);
  border-bottom: 2px solid var(--color-brand);
  border-radius: 0.5rem;
  pointer-events: none;
}
</style>
