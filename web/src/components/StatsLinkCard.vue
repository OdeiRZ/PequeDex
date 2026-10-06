<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFeedback } from '@/composables/useFeedback'

const { t } = useI18n()
const feedback = useFeedback()
</script>

<template>
  <RouterLink
    :to="{ name: 'stats' }"
    class="card-interactive flex items-center gap-3 rounded-2xl p-4"
    @click="feedback.nav()"
  >
    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-growth/15 text-growth">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-6 4 3 5-8" />
      </svg>
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold">{{ t('stats.linkCardTitle') }}</div>
      <div class="text-xs text-text-muted">{{ t('stats.linkCardBody') }}</div>
    </div>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-4 w-4 shrink-0 text-text-muted"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </RouterLink>
</template>
