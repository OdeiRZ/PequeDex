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

// mode="out-in" (wait for the leaving page to finish before mounting the
// next one) was here originally to stop DashboardView/ContractionsView's
// own onMounted polling intervals from briefly double-firing on a route
// change. It was later found to get permanently stuck on transitions
// touching welcome - the route and its resolved component are correct,
// yet nothing ever paints, neither the old page nor the new one - and
// the fix at the time was a narrow bypass for just that one route.
//
// Turns out that was the wrong scope: reproduced live now on the
// Dashboard <-> Contracciones pair too (no welcome involved at all,
// on a router with only two route-level Transitions in the whole app -
// this is the *other* one) - a plain client-side RouterLink navigation
// leaves the old <main> permanently stuck mid-leave (both its
// route-enter-from and route-leave-from/route-leave-active classes
// present at once, forever), even though a hard reload straight to the
// same URL renders that exact same view correctly every time. So the
// bug was never welcome-specific - out-in itself is what's unreliable
// here, and it had simply never been re-tested against any other route
// pair since the original fix. Dropped globally instead of growing a
// route-by-route allowlist that would only mask the same bug on the
// next new route (confirmed live it originally broke sounds too, the
// same way, the moment that route was added).
//
// Without "out-in", old and new render simultaneously (Vue's default) -
// confirmed live this still reads as a flicker of the old page's content
// even with the leaving page taken out of flow (position: absolute in
// base.css): it's still fully opaque for the first part of its own fade
// out, overlapping the entering page's own still-mostly-transparent fade
// in. The "route" transition below drops the leave transition entirely
// instead - the old page is taken out of flow and simply vanishes the
// instant it stops being the active route, so there's no window where
// both are visibly blended. The enter side keeps its fade-in. A brief
// double-mount (both views' onMounted firing once) is the accepted
// trade-off - every polling interval in both views already has a
// matching onUnmounted cleanup, so the overlap is at most one extra
// poll, not a leak.
</script>

<template>
  <div
    class="relative mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden bg-bg text-text"
  >
    <!-- Not shown on WelcomeView - it carries its own "Iniciar sesión"
         pill and brand mark over the animated hero, and the sticky
         header's own bg-bg bar would clip that background at the top of
         the screen. -->
    <AppHeader v-if="route.name !== 'welcome'" />
    <RouterView v-slot="{ Component }">
      <Transition name="route">
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
