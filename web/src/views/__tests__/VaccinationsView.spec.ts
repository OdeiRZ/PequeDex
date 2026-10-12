import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import VaccinationsView from '@/views/VaccinationsView.vue'
import { useBabiesStore, type Vaccination } from '@/stores/babies'
import { i18n } from '@/i18n'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

function vaccination(overrides: Partial<Vaccination>): Vaccination {
  return {
    id: 1,
    baby_id: 1,
    user_id: null,
    code: 'hexa_2m',
    name: 'Hexavalente (DTPa-VPI-Hib-HB)',
    age_label: '2 meses',
    due_date: '2026-10-01',
    given_at: null,
    optional: false,
    notes: null,
    edited: false,
    due_date_edited: false,
    ...overrides,
  }
}

const vaccinations = [
  vaccination({
    id: 1,
    code: 'hb_birth',
    name: 'Hepatitis B',
    age_label: 'Al nacer',
    optional: true,
    due_date: '2026-08-01',
  }),
  vaccination({ id: 2 }),
  vaccination({
    id: 3,
    code: 'men_4m',
    name: 'Meningococo ACWY',
    age_label: '4 meses',
    due_date: '2026-12-01',
    given_at: null,
  }),
]

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/vacunas', name: 'vaccinations', component: VaccinationsView },
    ],
  })
  return mount(VaccinationsView, { global: { plugins: [i18n, router] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  const babies = useBabiesStore()
  babies.current = {
    id: 1,
    name: 'Peque',
    due_date: null,
    birth_date: '2026-08-01',
    sex: 'nina',
    region: 'cantabria',
    vaccinations_enabled: true,
    invite_code: 'ABCD1234',
    water_broke_at: null,
  }
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/babies/1/vaccinations') {
      return Promise.resolve({
        data: {
          data: vaccinations,
          template: { source: 'Calendario común', year: 2026, region_specific: true },
        },
      })
    }
    if (url === '/babies/1/checkups') return Promise.resolve({ data: { data: [] } })
    throw new Error(`unexpected GET ${url}`)
  })
})

describe('VaccinationsView', () => {
  it('renders the vaccines grouped by age once loaded', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Al nacer')
    expect(wrapper.text()).toContain('2 meses')
    expect(wrapper.text()).toContain('Meningococo ACWY')
    expect(wrapper.text()).toContain('Plantilla: Calendario común (2026).')
  })

  it('shows the disabled message when the baby has them turned off', async () => {
    useBabiesStore().current!.vaccinations_enabled = false
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('no están activadas')
  })
})
