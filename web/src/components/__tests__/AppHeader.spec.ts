import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(() => Promise.resolve({})) } }
})

function montar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/bienvenida', name: 'welcome', component: { template: '<div />' } },
    ],
  })
  const auth = useAuthStore()
  auth.user = { id: 1, name: 'Odei', email: 'o@example.com', avatar: null } as never
  auth.token = 'abc'
  const wrapper = mount(AppHeader, { global: { plugins: [i18n, router] } })
  const salir = () => wrapper.get('button[aria-label="Cerrar sesión"]')
  return { wrapper, auth, salir }
}

describe('AppHeader logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    // ThemeToggle lo consulta; jsdom no lo trae.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })

  it('logs out straight away when nothing is waiting to be sent', async () => {
    const { auth, salir } = montar()

    await salir().trigger('click')

    expect(auth.user).toBeNull()
  })

  it('warns first when there are unsent changes, and logs out on the second tap', async () => {
    const { auth, salir } = montar()
    useBabiesStore().offlineQueue = [{ tempId: -1 } as never, { tempId: -2 } as never]

    await salir().trigger('click')
    expect(auth.user).not.toBeNull()
    expect(useToastStore().message).toContain('Tienes 2 cambios sin enviar')

    await salir().trigger('click')
    expect(auth.user).toBeNull()
  })
})
