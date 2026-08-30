<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { t } = useI18n()
</script>

<template>
  <main class="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center">
    <h1 class="font-display text-2xl font-bold">{{ t('notFound.title') }}</h1>
    <RouterLink
      :to="{ name: auth.isAuthenticated ? 'dashboard' : 'login' }"
      class="font-semibold text-brand"
    >
      {{ t('notFound.back') }}
    </RouterLink>
  </main>
</template>
