<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AccountSheet from '@/components/AccountSheet.vue'
import AppHeader from '@/components/AppHeader.vue'
import EmailVerificationBanner from '@/components/EmailVerificationBanner.vue'
import ToastNotification from '@/components/ToastNotification.vue'

const auth = useAuthStore()
const route = useRoute()

// A stored token survives a reload, but the user object it belongs to
// doesn't - without this, the header's name only ever appears if the
// session happened to pass through a view that fetched it itself, staying
// blank on a reload/deep link landing anywhere else. Lives here, at the
// root, so it runs once regardless of which page that turns out to be.
// Siempre se pide (aunque ya haya un usuario guardado en la foto del
// Dashboard, lib/snapshot.ts): lo pintado al abrir puede estar desfasado.
onMounted(() => {
  if (auth.isAuthenticated) {
    auth.fetchCurrentUser()
  }
})

// Sin <Transition> en el RouterView, a propósito. Antes había una con un
// fundido de entrada, y se dejó una vista antigua viva cada vez que se
// cambiaba de ruta (comprobado en producción: 1 -> 4 <main> tras seis
// navegaciones, también con `mode="out-in"`, que además llegó a dejar la
// pantalla en blanco). La causa: <Transition> solo sabe animar y retirar un
// elemento raíz, y varias vistas (Dashboard, Contracciones) tienen una raíz de
// varios nodos (<main> más hojas inferiores y visores como hermanos). La
// vista que salía no se desmontaba nunca: seguía en el DOM con sus
// temporizadores de sondeo funcionando, y salía un segundo <main> (que un
// lector de pantalla anuncia como otra página).
//
// Ahora Vue desmonta la vista anterior en el acto y el fundido de entrada es
// una animación CSS sobre `main` (ver `route-enter` en base.css), que no
// depende de gestionar la salida.
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
    <EmailVerificationBanner />
    <RouterView />
    <ToastNotification />
    <!-- Mounted here, not inside any one view, so the "Tu cuenta" link
         in AppHeader (also global) works from every route - it used to
         live only in DashboardView.vue, so it silently did nothing from
         /contracciones or any other page. -->
    <AccountSheet v-if="auth.user" />
  </div>
</template>
