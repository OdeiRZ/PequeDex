import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...original,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

describe('auth store: account data', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('deletes the account with the password and only then clears the local session', async () => {
    const auth = useAuthStore()
    auth.token = 'abc'
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { babies_deleted: 0, babies_left: 1 } })

    await auth.deleteAccount('mi-contraseña')

    expect(apiClient.delete).toHaveBeenCalledWith('/user', {
      data: { current_password: 'mi-contraseña' },
    })
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
  })

  it('keeps the session when the server refuses to delete the account', async () => {
    const auth = useAuthStore()
    auth.token = 'abc'
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('422'))

    await expect(auth.deleteAccount('mal')).rejects.toThrow()

    expect(auth.token).toBe('abc')
  })

  it('asks the API for the export as a blob', async () => {
    const auth = useAuthStore()
    const blob = new Blob(['{}'], { type: 'application/json' })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: blob })

    await expect(auth.exportData()).resolves.toBe(blob)
    expect(apiClient.get).toHaveBeenCalledWith('/user/export', { responseType: 'blob' })
  })
})
