<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  emit('update:open', false)
}

// Without this, a finger-scroll starting anywhere over the backdrop (or
// a mouse wheel over it) also scrolls the dashboard underneath - a fixed
// full-viewport backdrop doesn't stop that on its own, only body's own
// overflow does. Same fix as LudoDex's GameDetailModal. The lock itself
// lives in a plain module (bodyScrollLock.ts), not here - every sheet in
// DashboardView.vue is its own BottomSheet instance, and `<script
// setup>` code re-runs per instance, so state kept here wouldn't
// actually be shared between them the way a real module's is.
watch(
  () => props.open,
  (open) => {
    if (open) {
      lockBodyScroll()
    } else {
      unlockBodyScroll()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
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
