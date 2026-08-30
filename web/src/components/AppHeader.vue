<script setup lang="ts">
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3"
  >
    <span class="flex items-center gap-1.5 font-display text-xl font-bold">
      <span aria-hidden="true">👶</span>
      PequeDex
    </span>
    <div class="flex items-center gap-2">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  </header>
</template>
