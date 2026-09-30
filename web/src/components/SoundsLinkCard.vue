<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <RouterLink
    :to="{ name: 'sounds' }"
    class="card-interactive flex items-center gap-3 rounded-2xl p-4"
  >
    <span
      class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-teal/15 text-brand-teal"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold">{{ t('sounds.linkCardTitle') }}</div>
      <div class="text-xs text-text-muted">{{ t('sounds.linkCardBody') }}</div>
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
