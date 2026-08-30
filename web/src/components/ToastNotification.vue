<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Transition name="toast">
    <p v-if="toast.message" role="status" class="toast">
      {{ toast.message }}
    </p>
  </Transition>
</template>

<style scoped>
/* Fixed solid color, independent of the light/dark theme tokens: this
floats over whatever the dashboard is showing (timeline entries, a
milestone photo...), where a translucent or theme-reactive tint isn't
reliably legible against arbitrary content underneath. Same reasoning
as LudoDex/MIRA MarketLens's ToastNotification. */
.toast {
  position: fixed;
  left: 50%;
  bottom: 5.5rem;
  transform: translateX(-50%);
  z-index: 100;
  max-width: calc(100% - 2rem);
  border-radius: 999px;
  padding: 0.65rem 1.25rem;
  background: #1f7a4d;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.35);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
