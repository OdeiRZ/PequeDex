<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { t } = useI18n()
</script>

<template>
  <div class="not-found">
    <h1>{{ t('notFound.title') }}</h1>
    <RouterLink :to="{ name: auth.isAuthenticated ? 'dashboard' : 'login' }">{{
      t('notFound.back')
    }}</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  max-width: 380px;
  margin: 4rem auto 0;
  text-align: center;
}
</style>
