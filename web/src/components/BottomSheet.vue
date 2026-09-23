<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from 'vue'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  emit('update:open', false)
}

const panelRef = ref<HTMLElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null

// Keeps Tab/Shift+Tab cycling inside the sheet instead of escaping to
// the dashboard behind it (still technically focusable even though the
// backdrop covers it), and Escape closes it - without this, a keyboard
// user had no way to dismiss a sheet besides a mouse click on the
// backdrop. Same focusable-elements query as LudoDex's GameDetailModal.
function getFocusableElements(): HTMLElement[] {
  if (!panelRef.value) return []

  return Array.from(
    panelRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()

    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (focusable.length === 0) return

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// Falls back to this generated id for whichever sheet's heading doesn't
// already have one of its own - `useId()` (Vue 3.5+) is SSR-safe and
// stable across re-renders, unlike a plain module-scope counter shared
// by every BottomSheet instance on the page.
const generatedTitleId = useId()
const labelledBy = ref<string | undefined>(undefined)

// Finds each sheet's own heading instead of requiring every call site
// to thread an id through a scoped slot (12 sheets across 3 files) -
// without an `aria-labelledby`, a screen reader just announces
// "dialog" on open, with no hint of which one until it reads on into
// the content. Every sheet in practice leads with exactly one heading
// (`<h3>`, sometimes preceded by a decorative icon/emoji), so the
// first `h1`-`h4`/`[role="heading"]` found is safe to treat as the
// title. Runs on open, not just on mount, since every sheet is always
// mounted and only toggled via `open` - content for the sheet that's
// opening is already in the DOM by then.
function updateLabelledBy() {
  const heading = panelRef.value?.querySelector<HTMLElement>('h1, h2, h3, h4, [role="heading"]')

  if (!heading) {
    labelledBy.value = undefined

    return
  }

  if (!heading.id) {
    heading.id = generatedTitleId
  }

  labelledBy.value = heading.id
}

// Without this, a finger-scroll starting anywhere over the backdrop (or
// a mouse wheel over it) also scrolls the dashboard underneath - a fixed
// full-viewport backdrop doesn't stop that on its own, only body's own
// overflow does. Same fix as LudoDex's GameDetailModal. The lock itself
// lives in a plain module (bodyScrollLock.ts), not here - every sheet in
// DashboardView.vue is its own BottomSheet instance, and `<script
// setup>` code re-runs per instance, so state kept here wouldn't
// actually be shared between them the way a real module's is.
//
// Also drives focus (hallazgo de una auditoría de código): the sheet is
// always mounted, just toggled via `open` (unlike a v-if'd modal), so
// onMounted/onUnmounted can't do this the way GameDetailModal does - it
// has to react to `open` itself. Opening moves focus to the panel
// (tabindex="-1" in the template, remembering whatever had focus
// before) and starts trapping Tab; closing returns focus there and
// stops trapping.
watch(
  () => props.open,
  (open) => {
    if (open) {
      lockBodyScroll()
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKeydown)
      panelRef.value?.focus()
      updateLabelledBy()
    } else {
      unlockBodyScroll()
      window.removeEventListener('keydown', onKeydown)
      previouslyFocusedElement?.focus()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)

  if (props.open) {
    unlockBodyScroll()
  }
})

// Dragging the handle down to dismiss - the grey bar used to be purely
// decorative (a visual "this is a sheet" cue with nothing behind it).
// Past DISMISS_THRESHOLD_PX it closes on release; short of that it
// springs back, with rubber-band resistance past RESISTANCE_START_PX so
// the drag still tracks the finger but stops feeling 1:1 the further
// past the threshold it goes (same idea as iOS's own sheet/scroll
// overscroll). Only the handle is a drag target, not the whole panel -
// sheet content (inputs, selects) needs its own pointerdown to behave
// normally, not fight this for pointer capture.
const DISMISS_THRESHOLD_PX = 110
const RESISTANCE_START_PX = 60

const dragOffset = ref(0)
const dragging = ref(false)
let dragStartY = 0

function resistedOffset(rawDy: number): number {
  if (rawDy <= RESISTANCE_START_PX) return rawDy

  return RESISTANCE_START_PX + (rawDy - RESISTANCE_START_PX) * 0.4
}

function onGrabPointerDown(event: PointerEvent) {
  dragging.value = true
  dragStartY = event.clientY
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}

function onGrabPointerMove(event: PointerEvent) {
  if (!dragging.value) return

  const rawDy = Math.max(0, event.clientY - dragStartY)
  dragOffset.value = resistedOffset(rawDy)
}

function onGrabPointerUp(event: PointerEvent) {
  if (!dragging.value) return

  dragging.value = false
  const rawDy = Math.max(0, event.clientY - dragStartY)
  dragOffset.value = 0

  if (rawDy > DISMISS_THRESHOLD_PX) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200"
      :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
      @click.self="close"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelledBy"
        tabindex="-1"
        class="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-5 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.25)] ease-[cubic-bezier(0.32,0.72,0,1)]"
        :class="[open ? 'translate-y-0' : 'translate-y-full', dragging ? '' : 'transition-transform duration-300']"
        :style="{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }"
      >
        <div
          class="mx-auto mb-4 h-1.5 w-10 touch-none rounded-full bg-border transition-[background-color,width] active:bg-text-muted"
          :class="dragging && 'w-12'"
          @pointerdown="onGrabPointerDown"
          @pointermove="onGrabPointerMove"
          @pointerup="onGrabPointerUp"
          @pointercancel="onGrabPointerUp"
        ></div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
