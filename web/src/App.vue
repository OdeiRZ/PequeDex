<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import AppHeader from '@/components/AppHeader.vue'

const auth = useAuthStore()
const babies = useBabiesStore()

// A stored token survives a reload, but the user object it belongs to
// doesn't - without this, the header's name only ever appears if the
// session happened to pass through a view that fetched it itself, staying
// blank on a reload/deep link landing anywhere else. Lives here, at the
// root, so it runs once regardless of which page that turns out to be.
onMounted(() => {
  if (auth.isAuthenticated && !auth.user) {
    auth.fetchCurrentUser()
  }
})

// Retints the brand accent (see base.css) once the baby's sex is known -
// lives here rather than in DashboardView so it stays in sync everywhere,
// and clears itself on logout since auth.logout() resets the babies store.
watch(
  () => babies.current?.sex,
  (sex) => {
    if (sex === 'nino' || sex === 'nina') {
      document.documentElement.setAttribute('data-sex', sex)
    } else {
      document.documentElement.removeAttribute('data-sex')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-md flex-col bg-bg text-text">
    <AppHeader />
    <RouterView />
  </div>
</template>
