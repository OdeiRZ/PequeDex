<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AccountSheet from '@/components/AccountSheet.vue'
import AppHeader from '@/components/AppHeader.vue'
import ToastNotification from '@/components/ToastNotification.vue'

const auth = useAuthStore()
const route = useRoute()

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
  <div class="mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden bg-bg text-text">
    <!-- Not shown on WelcomeView - it carries its own "Iniciar sesión"
         pill and brand mark over the animated hero, and the sticky
         header's own bg-bg bar would clip that background at the top of
         the screen. -->
    <AppHeader v-if="route.name !== 'welcome'" />
    <RouterView v-slot="{ Component }">
      <Transition name="route" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <ToastNotification />
    <!-- Mounted here, not inside any one view, so the "Tu cuenta" link
         in AppHeader (also global) works from every route - it used to
         live only in DashboardView.vue, so it silently did nothing from
         /contracciones or any other page. -->
    <AccountSheet v-if="auth.user" />
  </div>
</template>
