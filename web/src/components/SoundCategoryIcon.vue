<script setup lang="ts">
import type { SoundCategory } from '@/lib/soundCategory'

defineProps<{ category: SoundCategory }>()
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
    <template v-if="category === 'white-noise'">
      <rect stroke-width="2" x="3" y="7" width="18" height="12" rx="2.5" />
      <circle stroke-width="2" cx="8" cy="13" r="2.4" />
      <path stroke-width="1.8" d="M14 11h4M14 15h2.5" />
      <path stroke-width="1.8" d="M7 7 9.5 3.5h5L17 7" />
    </template>
    <template v-else-if="category === 'rain'">
      <path
        stroke-width="2"
        d="M7 14a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1-.8 6.9H7Z"
      />
      <path stroke-width="2" d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" />
    </template>
    <path
      v-else-if="category === 'heartbeat'"
      fill="currentColor"
      stroke="none"
      d="M12 20.5c-4.6-3.1-9-6.9-9-11.2A5 5 0 0 1 12 6.2 5 5 0 0 1 21 9.3c0 4.3-4.4 8.1-9 11.2Z"
    />
    <template v-else-if="category === 'lullaby'">
      <circle stroke-width="2" cx="7" cy="18" r="2.6" />
      <circle stroke-width="2" cx="16" cy="16" r="2.6" />
      <path stroke-width="2" d="M9.6 18V5.5L18.6 4v12" />
    </template>
    <path
      v-else-if="category === 'waves'"
      stroke-width="2"
      d="M2 16c1.6 1.6 3.3 1.6 5 0s3.4-1.6 5 0 3.3 1.6 5 0 3.4-1.6 5 0M2 11c1.6 1.6 3.3 1.6 5 0s3.4-1.6 5 0 3.3 1.6 5 0 3.4-1.6 5 0"
    />
    <template v-else-if="category === 'fan'">
      <circle stroke-width="2" cx="12" cy="12" r="1.6" />
      <path
        stroke-width="2"
        d="M12 10.4C10.5 8 10.5 5 12 3c1.8 1 2.5 3.6 1.5 6M13.6 12c2.4-1.5 5.4-1.5 7.4 0-1 1.8-3.6 2.5-6 1.5M10.4 12c-2.4 1.5-5.4 1.5-7.4 0 1-1.8 3.6-2.5 6-1.5"
      />
    </template>
  </svg>
</template>
