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
    <path
      v-if="category === 'feed'"
      d="M9 2h6M10 2v3.5a2 2 0 0 1-.4 1.2L8 9.6A4 4 0 0 0 7 12v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7a4 4 0 0 0-1-2.4l-1.6-2.9A2 2 0 0 1 14 5.5V2M8 14h8"
    />
    <path v-else-if="category === 'sleep'" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    <template v-else-if="category === 'diaper'">
      <path d="M4 8c0-2.2 3.6-4 8-4s8 1.8 8 4-3.6 10-8 10-8-7.8-8-10Z" />
      <path d="M8 18c0 1.1 1.8 2 4 2s4-.9 4-2" />
    </template>
    <path v-else-if="category === 'growth'" d="M4 20 18 6M8 20h12V8" />
    <path
      v-else-if="category === 'milestone'"
      d="m12 2 2.9 6.6L22 9.3l-5 4.9 1.2 7-6.2-3.4L5.8 21.2 7 14.2l-5-4.9 7.1-.7Z"
    />
  </svg>
</template>
