<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="not-found">
    <h1>Página no encontrada</h1>
    <RouterLink :to="{ name: auth.isAuthenticated ? 'dashboard' : 'login' }">Volver</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  max-width: 380px;
  margin: 4rem auto 0;
  text-align: center;
}
</style>
