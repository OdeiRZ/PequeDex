import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const user = { id: 1, name: 'Odei', email: 'odei@example.com', avatar: null }

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('starts unauthenticated when there is no stored token', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('logs in, storing the user and token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { user, token: 'abc123' } })
    const store = useAuthStore()

    await store.login({ email: user.email, password: 'secret' })

    expect(store.user).toEqual(user)
    expect(store.token).toBe('abc123')
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('pequedex_token')).toBe('abc123')
    expect(apiClient.post).toHaveBeenCalledWith('/login', { email: user.email, password: 'secret' })
  })

  it('registers, storing the user and token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { user, token: 'abc123' } })
    const store = useAuthStore()

    await store.register({
      name: user.name,
      email: user.email,
      password: 'secret',
      password_confirmation: 'secret',
    })

    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
  })

  it('clears the session on logout, even if the request fails', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { user, token: 'abc123' } })
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))

    await expect(store.logout()).rejects.toThrow()

    expect(store.user).toBeNull()
    expect(store.token).toBeNull()
    expect(localStorage.getItem('pequedex_token')).toBeNull()
  })

  it('fetches the current user when a token is already stored', async () => {
    localStorage.setItem('pequedex_token', 'abc123')
    vi.mocked(apiClient.get).mockResolvedValue({ data: user })
    const store = useAuthStore()

    await store.fetchCurrentUser()

    expect(store.user).toEqual(user)
  })

  it('clears the session when fetching the current user fails', async () => {
    localStorage.setItem('pequedex_token', 'abc123')
    vi.mocked(apiClient.get).mockRejectedValue(new Error('unauthenticated'))
    const store = useAuthStore()

    await store.fetchCurrentUser()

    expect(store.user).toBeNull()
    expect(store.token).toBeNull()
  })

  it('updates the profile, replacing the stored user', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { user, token: 'abc123' } })
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    const updated = { ...user, name: 'Odei Riveiro' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: updated })

    await store.updateProfile({ name: 'Odei Riveiro', email: user.email })

    expect(store.user).toEqual(updated)
    expect(apiClient.put).toHaveBeenCalledWith('/user', { name: 'Odei Riveiro', email: user.email })
  })

  it('updates the password without touching the stored user', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { user, token: 'abc123' } })
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    vi.mocked(apiClient.put).mockResolvedValue({ data: undefined })

    await store.updatePassword({
      current_password: 'old',
      password: 'new-password',
      password_confirmation: 'new-password',
    })

    expect(store.user).toEqual(user)
  })

  it('uploads an avatar, replacing the stored user', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { user, token: 'abc123' } })
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    const withAvatar = { ...user, avatar: 'data:image/png;base64,xyz' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: withAvatar })

    await store.uploadAvatar(new File(['x'], 'yo.jpg', { type: 'image/jpeg' }))

    expect(store.user).toEqual(withAvatar)
  })

  it('removes the avatar locally after the request succeeds', async () => {
    const withAvatar = { ...user, avatar: 'data:image/png;base64,xyz' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { user: withAvatar, token: 'abc123' } })
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })

    await store.removeAvatar()

    expect(store.user?.avatar).toBeNull()
  })
})
