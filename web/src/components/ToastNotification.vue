<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Transition name="toast">
    <p
      v-if="toast.message"
      :key="toast.key"
      role="status"
      class="toast"
      :class="toast.type === 'error' ? 'toast-error' : 'toast-success'"
    >
      <svg
        v-if="toast.type === 'error'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4 shrink-0"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      {{ toast.message }}
    </p>
  </Transition>
</template>

<style scoped>
/* Fixed solid colors, independent of the light/dark theme tokens: this
floats over whatever the dashboard is showing (timeline entries, a
milestone photo...), where a translucent or theme-reactive tint isn't
reliably legible against arbitrary content underneath. Same reasoning
as LudoDex/MIRA MarketLens's ToastNotification - the red/green split
by type is the one thing PequeDex's own version didn't have yet. */
.toast {
  position: fixed;
  left: 50%;
  bottom: 5.5rem;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: calc(100% - 2rem);
  border-radius: 999px;
  padding: 0.65rem 1.25rem;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.35);
}

.toast-success {
  background: #1f7a4d;
}

.toast-error {
  background: #b3453f;
}

/* A small spring overshoot on entry reads as "alive" rather than a flat
   fade - the leave stays a plain fade+drop so the toast doesn't feel
   like it's fighting the user on the way out. */
.toast-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.15s ease;
  }

  .toast-enter-from {
    transform: translateX(-50%);
  }
}
</style>
