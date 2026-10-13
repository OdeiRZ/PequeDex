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

const params = { id: '7', hash: 'abc', expires: '1791849484', signature: 'sig' }

describe('auth store: email verification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('forwards the signed link parameters to the API untouched', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} })
    const auth = useAuthStore()
    auth.token = null

    await auth.verifyEmail(params)

    expect(apiClient.get).toHaveBeenCalledWith('/email/verify/7/abc', {
      params: { expires: '1791849484', signature: 'sig' },
    })
  })

  it('refreshes the user when there is a session, so the warning goes away', async () => {
    const auth = useAuthStore()
    auth.token = 'abc'
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { id: 1, email_verified_at: '2026-10-13T10:00:00Z' } })

    await auth.verifyEmail(params)

    expect(apiClient.get).toHaveBeenCalledWith('/user')
    expect(auth.user?.email_verified_at).toBe('2026-10-13T10:00:00Z')
  })

  it('rejects when the API refuses the link', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('403'))

    await expect(useAuthStore().verifyEmail(params)).rejects.toThrow()
  })
})
