<script setup lang="ts" generic="T extends string | number">
import { onMounted, ref, watch } from 'vue'

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

function scrollToIndex(index: number, smooth: boolean) {
  if (!scroller.value) return

  programmaticScroll = true
  scroller.value.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' })
  window.setTimeout(
    () => {
      programmaticScroll = false
    },
    smooth ? 300 : 0,
  )
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

function onScroll() {
  if (programmaticScroll) return

  window.clearTimeout(settleTimeout)
  settleTimeout = window.setTimeout(() => {
    if (!scroller.value) return

    const index = Math.min(
      props.items.length - 1,
      Math.max(0, Math.round(scroller.value.scrollTop / ITEM_HEIGHT)),
    )
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
      v-for="item in items"
      :key="item.value"
      class="wheel-item"
      role="option"
      :aria-selected="item.value === modelValue"
      :style="{ height: `${ITEM_HEIGHT}px` }"
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
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-muted);
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
