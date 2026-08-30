<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-sunken hover:text-danger"
    :aria-label="t('common.delete')"
    @click="$emit('click')"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-4 w-4"
    >
      <path
        d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
      />
    </svg>
  </button>
</template>
