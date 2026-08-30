import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

// Token lives in localStorage (not an httpOnly cookie): the SPA and the API
// are on different domains with free-tier hosting, so cookie-based Sanctum
// auth would fight with browsers' third-party cookie restrictions. Bearer
// tokens sidestep that at the cost of being readable by any script on the
// page (XSS risk) - an accepted tradeoff for a portfolio project with no
// sensitive financial/health data, revisited if that ever changes.
const TOKEN_STORAGE_KEY = 'pequedex_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
})

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// A 401 on an authenticated request means the token Sanctum issued has
// expired or been revoked server-side - without this, the stored token
// stayed in place and every subsequent request kept 401ing silently, with
// no indication the user needed to log in again. Only reacts when a token
// was actually attached (guards login/register's own failures, which are
// 422s anyway, from ever going through this path).
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && getStoredToken() !== null) {
      useAuthStore().clearSession()
      router.push({ name: 'login' })
    }

    return Promise.reject(error)
  },
)
