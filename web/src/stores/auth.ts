import { defineStore } from 'pinia'
import { apiClient, clearStoredToken, getStoredToken, storeToken } from '@/lib/api'
import type { Category } from '@/lib/category'
import { clearSnapshot, loadSnapshot } from '@/lib/snapshot'
import type { DiaperSize, TemperatureMethod } from './babies'
import { useBabiesStore } from './babies'
import { usePendingWritesStore } from './pendingWrites'
import { claimQueuesFor, discardAllQueues } from '@/lib/queueOwner'

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
  default_temperature_method: TemperatureMethod | null
  // Muestran/ocultan sus respectivas tarjetas de enlace en el
  // dashboard (`SoundsLinkCard.vue`/`StatsLinkCard.vue`) - no bloquean
  // la ruta en sí (`/sonidos`/`/estadisticas` siguen accesibles
  // directamente), mismo alcance que `today_summary_enabled` sobre
  // `TodaySummary.vue`.
  sounds_enabled: boolean
  stats_enabled: boolean
  /** Avisos suaves del Dashboard (DailyAlertsCard.vue). */
  alerts_enabled: boolean
  /** Panel de temperatura del Dashboard (TemperatureCard.vue), 48 h tras registrar una. */
  temperature_panel_enabled: boolean
  milestones_enabled: boolean
  /** null = el email aún no se ha confirmado. */
  email_verified_at: string | null
  /** Si el API exige el email confirmado (REQUIRE_EMAIL_VERIFICATION). Con
   * `false` no se le pide nada a nadie, aunque no haya confirmado. */
  email_verification_required: boolean
}

/** Lo que trae el enlace del correo de confirmación (ver VerifyEmailNotification). */
export interface EmailVerificationParams {
  id: string
  hash: string
  expires: string
  signature: string
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
    // El usuario de la última foto guardada (lib/snapshot.ts), si es de
    // esta sesión: la cabecera y los ajustes se pintan al instante y
    // fetchCurrentUser() lo refresca por detrás.
    user: loadSnapshot(getStoredToken())?.user ?? null,
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

      // A propósito: lo que quedara sin enviar se descarta (AppHeader avisa
      // antes si había algo), para no dejar datos en un móvil compartido.
      this.clearSession({ discardPending: true })

      if (token) {
        apiClient
          .post('/logout', undefined, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => {
            // best-effort - the local session is already gone either way.
          })
      }
    },

    // Confirma el email con los parámetros firmados del enlace del correo. Si
    // hay sesión, refresca el usuario para que el aviso de "confirma tu email"
    // desaparezca.
    async verifyEmail(params: EmailVerificationParams) {
      await apiClient.get(`/email/verify/${params.id}/${params.hash}`, {
        params: { expires: params.expires, signature: params.signature },
      })
      if (this.token) await this.fetchCurrentUser()
    },

    async resendEmailVerification() {
      await apiClient.post('/email/verification-notification')
    },

    // Borra la cuenta en el servidor (pide la contraseña) y, solo si sale
    // bien, cierra la sesión local. Los bebés que solo cuidaba esta persona
    // se borran allí con su historial; ver AccountDeleter en el API.
    async deleteAccount(currentPassword: string) {
      await apiClient.delete('/user', { data: { current_password: currentPassword } })
      this.clearSession({ discardPending: true })
    },

    // Todos los datos de la cuenta en un JSON (portabilidad). Devuelve el
    // Blob; quien lo llama dispara la descarga (mismo patrón que los PDF).
    async exportData(): Promise<Blob> {
      const { data } = await apiClient.get('/user/export', { responseType: 'blob' })
      return data
    },

    async updateProfile(payload: UpdateProfilePayload) {
      const { data } = await apiClient.put('/user', payload)
      this.user = data
    },

    /** Cambia una opción de la cuenta "local primero": se ve al instante y se
     * envía por detrás, así que también se puede cambiar sin conexión (queda
     * pendiente y sube sola al volver la red, ver stores/pendingWrites.ts).
     * Si el servidor la rechaza, se deshace y el error llega a quien llama. */
    async savePreference(url: string, body: Partial<User>) {
      const keys = Object.keys(body) as (keyof User)[]
      const before = this.user ? { ...this.user } : null
      if (this.user) this.user = { ...this.user, ...body }

      try {
        await usePendingWritesStore().commit(
          { key: `user:${url}`, method: 'put', url, body },
          apiClient,
        )
      } catch (error) {
        if (before && this.user) {
          const restored: Record<string, unknown> = { ...this.user }
          for (const key of keys) restored[key] = before[key]
          this.user = restored as unknown as User
        }
        throw error
      }
    },

    /** Tras traer el usuario del servidor (o al abrir la app): vuelve a poner
     * encima las opciones cambiadas que aún no han subido, para que no se
     * pisen con el valor viejo. */
    reapplyPending() {
      if (!this.user) return
      let user = this.user
      for (const write of usePendingWritesStore().items) {
        if (write.key.startsWith('user:')) user = { ...user, ...(write.body as Partial<User>) }
      }
      if (user !== this.user) this.user = user
    },

    async updateActionBarCategories(categories: Category[]) {
      await this.savePreference('/user/action-bar', { action_bar_categories: categories })
    },

    async updatePredictionsEnabled(enabled: boolean) {
      await this.savePreference('/user/predictions', { predictions_enabled: enabled })
    },

    async updateSwipeToDeleteEnabled(enabled: boolean) {
      await this.savePreference('/user/swipe-to-delete', { swipe_to_delete_enabled: enabled })
    },

    async updateTodaySummaryEnabled(enabled: boolean) {
      await this.savePreference('/user/today-summary', { today_summary_enabled: enabled })
    },

    async updateInteractionFeedbackEnabled(enabled: boolean) {
      await this.savePreference('/user/interaction-feedback', {
        interaction_feedback_enabled: enabled,
      })
    },

    async updateDefaultDiaperSize(size: DiaperSize | null) {
      await this.savePreference('/user/default-diaper-size', { default_diaper_size: size })
    },

    async updateDefaultTemperatureMethod(method: TemperatureMethod | null) {
      await this.savePreference('/user/default-temperature-method', {
        default_temperature_method: method,
      })
    },

    async updateDefaultFeedDuration(minutes: number | null) {
      await this.savePreference('/user/default-feed-duration', {
        default_feed_duration_minutes: minutes,
      })
    },

    async updateSoundsEnabled(enabled: boolean) {
      await this.savePreference('/user/sounds', { sounds_enabled: enabled })
    },

    async updateAlertsEnabled(enabled: boolean) {
      await this.savePreference('/user/alerts', { alerts_enabled: enabled })
    },

    async updateTemperaturePanelEnabled(enabled: boolean) {
      await this.savePreference('/user/temperature-panel', {
        temperature_panel_enabled: enabled,
      })
    },

    async updateStatsEnabled(enabled: boolean) {
      await this.savePreference('/user/stats', { stats_enabled: enabled })
    },

    async updateMilestonesEnabled(enabled: boolean) {
      await this.savePreference('/user/milestones', { milestones_enabled: enabled })
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
        this.claimQueues(data.id)
        this.reapplyPending()
      } catch {
        // Un 401 (token caducado o revocado) ya lo gestiona el interceptor
        // de lib/api.ts, que cierra la sesión. Cualquier otro fallo - sin
        // conexión, el API despertando, un 500 - NO debe cerrarla: antes,
        // abrir la app sin red desconectaba al usuario. Se queda con el
        // usuario que hubiera (el de la foto guardada) hasta el próximo intento.
      }
    },

    setSession(user: User, token: string) {
      this.user = user
      this.token = token
      storeToken(token)
      this.claimQueues(user.id)
    },

    // Las colas de cambios sin enviar son de una cuenta: si eran de otra, se
    // descartan y los stores se recargan vacíos - ver lib/queueOwner.ts.
    claimQueues(userId: number) {
      if (claimQueuesFor(userId)) {
        usePendingWritesStore().$reset()
        useBabiesStore().$reset()
      }
    },

    /** Only ever clears *this* store's own state - without also resetting
     * the babies store here, whoever's timeline was already loaded in
     * memory would briefly leak into a next account logging in on the
     * same tab (see LudoDex's own auth store for the same pattern). */
    // discardPending: al cerrar sesión o borrar la cuenta a propósito. Sin él
    // (la sesión caducó, un 401) las colas se conservan para cuando vuelva a
    // entrar la misma persona - ver lib/queueOwner.ts.
    clearSession({ discardPending = false }: { discardPending?: boolean } = {}) {
      this.user = null
      this.token = null
      clearStoredToken()
      clearSnapshot()
      if (discardPending) discardAllQueues()
      // $reset vuelve a leer las colas de localStorage: vacías si se acaban de
      // descartar, las mismas si se conservan.
      usePendingWritesStore().$reset()
      useBabiesStore().$reset()
    },
  },
})
