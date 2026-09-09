<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
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
        tabindex="-1"
        class="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-5 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        :class="open ? 'translate-y-0' : 'translate-y-full'"
        style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom))"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-border"></div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
