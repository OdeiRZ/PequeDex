<script setup lang="ts">
import { computed } from 'vue'

// A personal photo, unlike MIRA MarketLens's UserLogo (a company logo,
// which isn't necessarily square) - cropped to fill a circle instead of
// just contained, since that's the shape people expect for their own
// avatar.
const props = withDefaults(defineProps<{ name: string; avatar?: string | null; size?: number }>(), {
  avatar: null,
  size: 32,
})

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <img
    v-if="avatar"
    :src="avatar"
    :alt="name"
    class="shrink-0 rounded-full object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <span
    v-else
    class="grid shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-brand-ink"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.45}px` }"
  >
    {{ initial }}
  </span>
</template>
