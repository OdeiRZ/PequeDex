<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeLocale, type Locale } from '@/i18n'

const { locale, t } = useI18n()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as Locale
  locale.value = value
  storeLocale(value)
}
</script>

<template>
  <select :aria-label="t('language.label')" :value="locale" @change="onChange">
    <option value="es">{{ t('language.es') }}</option>
    <option value="en">{{ t('language.en') }}</option>
  </select>
</template>
