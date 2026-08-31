<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    /** Full mark (with toes) for headers/splash; reduced (no toes) for tight spots like tab icons. */
    full?: boolean
    /** Heartbeat + step-bob, used only on the loading screen. */
    animated?: boolean
    /** Rendered width in px; height follows from the viewBox aspect ratio. */
    size?: number
  }>(),
  { full: false, animated: false, size: 28 },
)

// Unique per instance so multiple marks on the same page don't collide on
// the gradient id - two <svg> elements referencing the same "url(#id)" only
// break if the id itself collides, but no reason to rely on there always
// being just one mark on screen.
const gradientId = `pequedex-mark-${useId()}`
</script>

<template>
  <svg
    v-if="full"
    :style="{ width: `${size}px`, height: 'auto' }"
    viewBox="0 0 84 100"
    aria-hidden="true"
    :class="{ 'motion-safe:animate-footprint-bob': animated }"
  >
    <defs>
      <linearGradient
        :id="gradientId"
        x1="0"
        y1="0"
        x2="84"
        y2="100"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="var(--brand)" />
        <stop offset="100%" stop-color="var(--brand-teal)" />
      </linearGradient>
    </defs>
    <ellipse cx="42" cy="62" rx="26" ry="34" :fill="`url(#${gradientId})`" />
    <ellipse
      cx="16"
      cy="24"
      rx="7"
      ry="9"
      :fill="`url(#${gradientId})`"
      transform="rotate(-10 16 24)"
    />
    <ellipse
      cx="32"
      cy="14"
      rx="7.5"
      ry="10"
      :fill="`url(#${gradientId})`"
      transform="rotate(-4 32 14)"
    />
    <ellipse cx="50" cy="12" rx="7.5" ry="10" :fill="`url(#${gradientId})`" />
    <ellipse
      cx="66"
      cy="16"
      rx="7"
      ry="9.5"
      :fill="`url(#${gradientId})`"
      transform="rotate(8 66 16)"
    />
    <path
      d="M42 54 c-4 -6 -13 -4 -13 3 c0 6 8 11 13 15 c5 -4 13 -9 13 -15 c0 -7 -9 -9 -13 -3 Z"
      fill="var(--brand-ink)"
      class="origin-center [transform-box:fill-box]"
      :class="{ 'motion-safe:animate-heartbeat': animated }"
    />
  </svg>

  <svg
    v-else
    :style="{ width: `${size}px`, height: 'auto' }"
    viewBox="0 0 84 84"
    aria-hidden="true"
    :class="{ 'motion-safe:animate-footprint-bob': animated }"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="84" y2="84" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--brand)" />
        <stop offset="100%" stop-color="var(--brand-teal)" />
      </linearGradient>
    </defs>
    <ellipse cx="42" cy="42" rx="28" ry="32" :fill="`url(#${gradientId})`" />
    <path
      d="M42 32 c-4.4 -6.6 -14.3 -4.4 -14.3 3.3 c0 6.6 8.8 12.1 14.3 16.5 c5.5 -4.4 14.3 -9.9 14.3 -16.5 c0 -7.7 -9.9 -9.9 -14.3 -3.3 Z"
      fill="var(--brand-ink)"
      class="origin-center [transform-box:fill-box]"
      :class="{ 'motion-safe:animate-heartbeat': animated }"
    />
  </svg>
</template>
