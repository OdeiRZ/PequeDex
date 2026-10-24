import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { installViewTransitions } from '@/lib/viewTransition'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bienvenida',
      name: 'welcome',
      component: () => import('@/views/WelcomeView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { guestOnly: true },
    },
    {
      // El enlace del correo de confirmación: se abre con o sin sesión (a veces
      // en otro dispositivo), así que sin `requiresAuth` ni `guestOnly`.
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/views/VerifyEmailView.vue'),
    },
    {
      path: '/contracciones',
      name: 'contractions',
      component: () => import('@/views/ContractionsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sonidos',
      name: 'sounds',
      component: () => import('@/views/SoundsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/estadisticas',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/vacunas',
      name: 'vaccinations',
      component: () => import('@/views/VaccinationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'welcome' }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

// Fundido entre pantallas (lib/viewTransition.ts). Después del guard de sesión:
// una redirección no llega a empezar ninguna transición.
installViewTransitions(router)

// Cada pantalla salvo el Dashboard se descarga aparte la primera vez que
// se abre (`() => import(...)` arriba). Si esa descarga falla - justo
// tras un despliegue, o con mala conexión -, vue-router cancela la
// navegación sin avisar y el enlace "no hace nada" hasta recargar
// (visto en vivo al abrir Vacunas recién activadas). En vez de eso, se
// carga la pantalla de destino con una navegación normal del navegador.
// Una sola vez por destino y minuto, para no entrar en bucle si el
// fichero sigue sin estar disponible.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk/i
const RELOAD_GUARD_KEY = 'pequedex.chunkReload'

export function shouldReloadAfterChunkError(
  message: string,
  target: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  now: number = Date.now(),
): boolean {
  if (!CHUNK_ERROR.test(message)) return false
  try {
    const previous = JSON.parse(storage?.getItem(RELOAD_GUARD_KEY) ?? 'null') as {
      target: string
      at: number
    } | null
    if (previous && previous.target === target && now - previous.at < 60_000) return false
    storage?.setItem(RELOAD_GUARD_KEY, JSON.stringify({ target, at: now }))
  } catch {
    // sin almacenamiento: se recarga igualmente (sin freno)
  }
  return true
}

router.onError((error: Error, to) => {
  const target = router.resolve(to).href
  let storage: Storage | null = null
  try {
    storage = window.sessionStorage
  } catch {
    storage = null
  }
  if (shouldReloadAfterChunkError(error.message, target, storage)) {
    window.location.assign(target)
  }
})

export default router
