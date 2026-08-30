<script setup lang="ts">
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3"
  >
    <span class="flex items-center gap-1.5 font-display text-xl font-bold">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-6 w-6 text-brand"
      >
        <path
          d="M9 12h.01M15 12h.01M8 20l-2 2M16 20l2 2M12 2a5 5 0 0 0-5 5c0 1.6.7 2.7 1.6 3.8-.5.7-1 1.6-1.3 2.6-.4 1.3.5 2.6 1.9 2.6h9.6c1.4 0 2.3-1.3 1.9-2.6-.3-1-.8-1.9-1.3-2.6.9-1.1 1.6-2.2 1.6-3.8a5 5 0 0 0-5-5Z"
        />
      </svg>
      PequeDex
    </span>
    <div class="flex items-center gap-2">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  </header>
</template>
