<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeLocale, type Locale } from '@/i18n'

const { locale, t } = useI18n()

function select(value: Locale) {
  locale.value = value
  storeLocale(value)
}
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-full border border-border text-xs font-semibold"
    role="group"
    :aria-label="t('language.label')"
  >
    <button
      type="button"
      class="px-2.5 py-1.5 transition-colors"
      :class="locale === 'es' ? 'bg-brand text-brand-ink' : 'text-text-muted'"
      :aria-pressed="locale === 'es'"
      @click="select('es')"
    >
      ES
    </button>
    <button
      type="button"
      class="px-2.5 py-1.5 transition-colors"
      :class="locale === 'en' ? 'bg-brand text-brand-ink' : 'text-text-muted'"
      :aria-pressed="locale === 'en'"
      @click="select('en')"
    >
      EN
    </button>
  </div>
</template>
