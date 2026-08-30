<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const auth = useAuthStore()

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
</script>

<template>
  <div class="language-switcher-slot">
    <LanguageSwitcher />
  </div>
  <RouterView />
</template>

<style scoped>
.language-switcher-slot {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
}
</style>
