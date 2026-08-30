<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div>
    <h1>PequeDex</h1>
    <p v-if="auth.user">Hola, {{ auth.user.name }}.</p>
    <button type="button" @click="onLogout">Cerrar sesión</button>
  </div>
</template>
