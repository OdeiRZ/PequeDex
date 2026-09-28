<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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

// "out-in" is what stops DashboardView/ContractionsView's own onMounted
// polling intervals from briefly double-firing on a route change (their
// own comments explain why), but confirmed live: any transition into or
// out of welcome under "out-in" gets stuck forever - the route and its
// resolved component are correct, yet nothing paints, neither the old
// page nor the new one - regardless of AppHeader's v-if (tried v-show)
// or an explicit :duration override (tried both). Whatever in that
// specific pairing breaks Vue's leave/enter sequencing, dropping "out-in"
// only for transitions touching welcome (either direction) sidesteps it
// without giving up the double-mount protection everywhere else.
//
// Without "out-in", old and new render simultaneously (Vue's default) -
// confirmed live this still reads as a flicker of the old page's content
// even with the leaving page taken out of flow (position: absolute in
// base.css): it's still fully opaque for the first part of its own fade
// out, overlapping the entering page's own still-mostly-transparent fade
// in. `routeTransitionName` switches to "route-instant-leave" for these
// transitions - same fade-in on enter, but the leave has no transition
// at all (base.css), so the old page just vanishes the instant it stops
// being the active route instead of lingering, fully visible, through
// part of a crossfade.
const transitionMode = ref<'out-in' | undefined>('out-in')
const routeTransitionName = ref<'route' | 'route-instant-leave'>('route')
watch(
  () => route.name,
  (to, from) => {
    const touchesWelcome = to === 'welcome' || from === 'welcome'
    transitionMode.value = touchesWelcome ? undefined : 'out-in'
    routeTransitionName.value = touchesWelcome ? 'route-instant-leave' : 'route'
  },
  { immediate: true },
)
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
      <Transition :name="routeTransitionName" :mode="transitionMode">
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
