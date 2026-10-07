import { defineStore } from 'pinia'
import { apiClient, clearStoredToken, getStoredToken, storeToken } from '@/lib/api'
import type { Category } from '@/lib/category'
import type { DiaperSize } from './babies'
import { useBabiesStore } from './babies'

export interface User {
  id: number
  name: string
  email: string
  avatar: string | null
  // null = las 5 categorias visibles (valor por defecto, sin personalizar).
  action_bar_categories: Category[] | null
  predictions_enabled: boolean
  swipe_to_delete_enabled: boolean
  today_summary_enabled: boolean
  interaction_feedback_enabled: boolean
  // Preseleccionan el valor correspondiente al abrir "+ Pañal"/"+ Toma"
  // para crear (nunca al editar, que siempre muestra el de la propia
  // entrada) - null = sin valor por defecto, el formulario arranca
  // como hoy ("Sin indicar").
  default_diaper_size: DiaperSize | null
  default_feed_duration_minutes: number | null
  // Muestran/ocultan sus respectivas tarjetas de enlace en el
  // dashboard (`SoundsLinkCard.vue`/`StatsLinkCard.vue`) - no bloquean
  // la ruta en sí (`/sonidos`/`/estadisticas` siguen accesibles
  // directamente), mismo alcance que `today_summary_enabled` sobre
  // `TodaySummary.vue`.
  sounds_enabled: boolean
  stats_enabled: boolean
  milestones_enabled: boolean
}

interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
  // Quien llega desde "Tengo una invitación" en la bienvenida se une al
  // bebé en el mismo paso (ver AuthController::register() en el backend) -
  // un registro normal, sin invitación, no manda este campo.
  invite_code?: string
}

interface LoginPayload {
  email: string
  password: string
}

interface UpdateProfilePayload {
  name: string
  email: string
}

interface UpdatePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

interface AuthState {
  user: User | null
  token: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: getStoredToken(),
  }),

  getters: {
    isAuthenticated: (state) => state.token !== null,
  },

  actions: {
    async register(payload: RegisterPayload) {
      const { data } = await apiClient.post('/register', payload)
      this.setSession(data.user, data.token)
    },

    async login(payload: LoginPayload) {
      const { data } = await apiClient.post('/login', payload)
      this.setSession(data.user, data.token)
    },

    async forgotPassword(email: string) {
      await apiClient.post('/forgot-password', { email })
    },

    async resetPassword(payload: ResetPasswordPayload) {
      await apiClient.post('/reset-password', payload)
    },

    // Clears the local session synchronously, before the /logout request
    // even goes out - the caller (AppHeader) navigates away right after
    // calling this, in the same tick, so Vue batches both reactive
    // changes into one render instead of painting a still-mounted
    // Dashboard against newly-null auth.user/babies.current for a frame
    // while router.push was still in flight (a real, visible flicker on
    // the way out). Revoking the token server-side is still worth doing,
    // just not something the UI should wait on - captures the token
    // before clearing it locally and sends it explicitly, since the
    // request interceptor's own lookup (getStoredToken()) runs on a
    // later microtask, after clearStoredToken() below has already run.
    logout() {
      const token = getStoredToken()

      this.clearSession()

      if (token) {
        apiClient
          .post('/logout', undefined, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => {
            // best-effort - the local session is already gone either way.
          })
      }
    },

    async updateProfile(payload: UpdateProfilePayload) {
      const { data } = await apiClient.put('/user', payload)
      this.user = data
    },

    async updateActionBarCategories(categories: Category[]) {
      const { data } = await apiClient.put('/user/action-bar', {
        action_bar_categories: categories,
      })
      this.user = data
    },

    async updatePredictionsEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/predictions', {
        predictions_enabled: enabled,
      })
      this.user = data
    },

    async updateSwipeToDeleteEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/swipe-to-delete', {
        swipe_to_delete_enabled: enabled,
      })
      this.user = data
    },

    async updateTodaySummaryEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/today-summary', {
        today_summary_enabled: enabled,
      })
      this.user = data
    },

    async updateInteractionFeedbackEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/interaction-feedback', {
        interaction_feedback_enabled: enabled,
      })
      this.user = data
    },

    async updateDefaultDiaperSize(size: DiaperSize | null) {
      const { data } = await apiClient.put('/user/default-diaper-size', {
        default_diaper_size: size,
      })
      this.user = data
    },

    async updateDefaultFeedDuration(minutes: number | null) {
      const { data } = await apiClient.put('/user/default-feed-duration', {
        default_feed_duration_minutes: minutes,
      })
      this.user = data
    },

    async updateSoundsEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/sounds', { sounds_enabled: enabled })
      this.user = data
    },

    async updateStatsEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/stats', { stats_enabled: enabled })
      this.user = data
    },

    async updateMilestonesEnabled(enabled: boolean) {
      const { data } = await apiClient.put('/user/milestones', { milestones_enabled: enabled })
      this.user = data
    },

    async updatePassword(payload: UpdatePasswordPayload) {
      await apiClient.put('/user/password', payload)
    },

    async uploadAvatar(file: File) {
      const form = new FormData()
      form.append('avatar', file)

      const { data } = await apiClient.post('/user/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      this.user = data
    },

    async removeAvatar() {
      await apiClient.delete('/user/avatar')
      if (this.user) {
        this.user.avatar = null
      }
    },

    /** Restores `user` from a token already in storage (e.g. after a page reload). */
    async fetchCurrentUser() {
      if (!this.token) {
        return
      }

      try {
        const { data } = await apiClient.get('/user')
        this.user = data
      } catch {
        this.clearSession()
      }
    },

    setSession(user: User, token: string) {
      this.user = user
      this.token = token
      storeToken(token)
    },

    /** Only ever clears *this* store's own state - without also resetting
     * the babies store here, whoever's timeline was already loaded in
     * memory would briefly leak into a next account logging in on the
     * same tab (see LudoDex's own auth store for the same pattern). */
    clearSession() {
      this.user = null
      this.token = null
      clearStoredToken()
      useBabiesStore().$reset()
    },
  },
})
