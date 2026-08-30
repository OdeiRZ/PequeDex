import { defineStore } from 'pinia'
import { apiClient, clearStoredToken, getStoredToken, storeToken } from '@/lib/api'
import { useBabiesStore } from './babies'

export interface User {
  id: number
  name: string
  email: string
  avatar: string | null
}

interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
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

    async logout() {
      try {
        await apiClient.post('/logout')
      } finally {
        this.clearSession()
      }
    },

    async updateProfile(payload: UpdateProfilePayload) {
      const { data } = await apiClient.put('/user', payload)
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
