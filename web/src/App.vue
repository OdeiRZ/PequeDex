<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import { startBackgroundSync, type BackgroundSync } from '@/lib/backgroundSync'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import AccountSheet from '@/components/AccountSheet.vue'
import AppHeader from '@/components/AppHeader.vue'
import EmailVerificationBanner from '@/components/EmailVerificationBanner.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
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

// Envío de lo pendiente (la cola sin conexión) desde TODA la app, no solo con
// la pantalla de inicio abierta: reintentos cortos, sonda previa y reintento
// inmediato al volver la conexión o la app (lib/backgroundSync.ts).
const babies = useBabiesStore()
const toast = useToastStore()
const { t } = useI18n()
const pendingCount = computed(() => babies.offlineQueue.length + babies.offlineUpdates.length)
let sync: BackgroundSync | null = null

function stopSync() {
  sync?.stop()
  sync = null
}

watch(
  () => auth.isAuthenticated,
  (loggedIn) => {
    stopSync()
    if (!loggedIn) return
    sync = startBackgroundSync({
      pendingCount: () => pendingCount.value,
      flush: async () => {
        await babies.whenFlushIdle()
        return babies.flushOfflineQueue()
      },
      abortStuck: (minAgeMs) => babies.abortStuckFlush(minAgeMs),
      onSent: (count) => toast.show(t('offline.sent', { count }, count)),
    })
  },
  { immediate: true },
)

// Algo nuevo en la cola: se asegura un reintento si el primer envío no llega.
watch(pendingCount, (now, before) => {
  if (now > before) sync?.notifyPending()
})

onUnmounted(stopSync)

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
  <div class="relative mx-auto flex min-h-screen max-w-md flex-col overflow-x-clip bg-bg text-text">
    <!-- Not shown on WelcomeView - it carries its own "Iniciar sesión"
         pill and brand mark over the animated hero, and the sticky
         header's own bg-bg bar would clip that background at the top of
         the screen. -->
    <AppHeader v-if="route.name !== 'welcome'" />
    <UpdateBanner />
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
