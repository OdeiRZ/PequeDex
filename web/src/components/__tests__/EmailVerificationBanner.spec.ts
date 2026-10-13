import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useAuthStore, type User } from '@/stores/auth'
import { apiClient } from '@/lib/api'
import EmailVerificationBanner from '@/components/EmailVerificationBanner.vue'

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...original,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

function userWith(overrides: Partial<User>): User {
  return { id: 1, name: 'Odei', email: 'odei@example.com', ...overrides } as User
}

function mountBanner() {
  return mount(EmailVerificationBanner, { global: { plugins: [i18n] } })
}

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows nothing while the API does not require verification', () => {
    useAuthStore().user = userWith({ email_verification_required: false, email_verified_at: null })

    expect(mountBanner().find('[role="status"]').exists()).toBe(false)
  })

  it('shows nothing once the email is confirmed', () => {
    useAuthStore().user = userWith({
      email_verification_required: true,
      email_verified_at: '2026-10-13T10:00:00Z',
    })

    expect(mountBanner().find('[role="status"]').exists()).toBe(false)
  })

  it('shows nothing without a logged-in user', () => {
    expect(mountBanner().find('[role="status"]').exists()).toBe(false)
  })

  it('warns an unconfirmed user when verification is required, and can resend the email', async () => {
    useAuthStore().user = userWith({ email_verification_required: true, email_verified_at: null })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {} })

    const wrapper = mountBanner()
    expect(wrapper.text()).toContain('odei@example.com')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/email/verification-notification')
    expect(wrapper.text()).toMatch(/enviado|sent/)
  })
})
