<script setup lang="ts">
import type { Category } from '@/lib/category'

defineProps<{ category: Category }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="category === 'feed'">
      <path
        stroke-width="2.4"
        d="M9.5 4h5M10.5 4v2.6L8.5 9.3a2 2 0 0 0-.5 1.3V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8.4a2 2 0 0 0-.5-1.3l-2-2.7V4"
      />
      <path stroke-width="2" d="M8 13h8" />
    </template>
    <template v-else-if="category === 'sleep'">
      <path
        fill="currentColor"
        stroke="none"
        d="M21 13.2A9 9 0 1 1 10.8 3a7.2 7.2 0 0 0 10.2 10.2Z"
      />
      <rect
        fill="currentColor"
        stroke="none"
        x="15.2"
        y="3.3"
        width="2.6"
        height="2.6"
        rx="0.6"
        transform="rotate(45 16.5 4.6)"
      />
      <rect
        fill="currentColor"
        stroke="none"
        x="18.7"
        y="7.2"
        width="1.7"
        height="1.7"
        rx="0.4"
        transform="rotate(45 19.55 8.05)"
      />
    </template>
    <template v-else-if="category === 'diaper'">
      <rect stroke-width="2.2" x="4" y="6" width="16" height="13" rx="4" />
      <path stroke-width="2.2" d="M14.5 6v2.8a2 2 0 0 0 2 2H20" />
    </template>
    <path v-else-if="category === 'growth'" d="M4 20 18 6M8 20h12V8" />
    <path
      v-else-if="category === 'milestone'"
      fill="currentColor"
      stroke="none"
      d="M12 1.5 14.53 8.52 21.99 8.75 16.09 13.33 18.17 20.49 12 16.3 5.83 20.49 7.91 13.33 2.01 8.75 9.47 8.52Z"
    />
  </svg>
</template>
