<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  emit('update:open', false)
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
        class="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        :class="open ? 'translate-y-0' : 'translate-y-full'"
        style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom))"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-border"></div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
