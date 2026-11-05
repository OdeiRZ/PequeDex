import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
// Los stores antes que lib/api, como en el resto de specs: lib/api importa los
// stores y, al revés, dejaría a estos atados a la API real en vez del mock.
import { useAuthStore, type User } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import { usePendingWritesStore } from '@/stores/pendingWrites'
import { apiClient } from '@/lib/api'
import { PENDING_WRITES_KEY } from '@/lib/pendingWrites'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const noNetwork = { isAxiosError: true, code: 'ERR_NETWORK' }
const rejected = { isAxiosError: true, response: { status: 422, data: {} } }
const config = { timeout: 20_000 }

const user = {
  id: 1,
  name: 'Odei',
  email: 'odei@example.com',
  avatar: null,
  action_bar_categories: null,
  alerts_enabled: true,
} as unknown as User

const baby = {
  id: 1,
  name: 'Peque',
  due_date: null,
  birth_date: '2026-09-01',
  sex: null,
  region: null,
  vaccinations_enabled: false,
  invite_code: 'ABCD1234',
  water_broke_at: null,
}

function storedWrites() {
  return JSON.parse(localStorage.getItem(PENDING_WRITES_KEY) ?? '[]')
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('pending writes (changes made without a connection)', () => {
  it('saves straight away when the server answers', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
    const pending = usePendingWritesStore()

    const result = await pending.commit(
      { key: 'k', method: 'put', url: '/x', body: { a: 1 } },
      apiClient,
    )

    expect(result).toBe('saved')
    expect(pending.count).toBe(0)
    expect(apiClient.put).toHaveBeenCalledWith('/x', { a: 1 }, config)
  })

  it('keeps the change on the phone without a connection, and sends it when it is back', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(noNetwork)
    const pending = usePendingWritesStore()

    const result = await pending.commit(
      { key: 'k', method: 'put', url: '/x', body: { a: 1 } },
      apiClient,
    )

    expect(result).toBe('queued')
    expect(pending.count).toBe(1)
    expect(storedWrites()).toHaveLength(1)

    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
    const { sent } = await pending.flush(apiClient)

    expect(sent).toBe(1)
    expect(pending.count).toBe(0)
    expect(storedWrites()).toHaveLength(0)
  })

  it('only sends the last value of something changed twice offline', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)
    const pending = usePendingWritesStore()

    await pending.commit({ key: 'k', method: 'put', url: '/x', body: { on: true } }, apiClient)
    await pending.commit({ key: 'k', method: 'put', url: '/x', body: { on: false } }, apiClient)

    expect(pending.items.map((w) => w.body)).toEqual([{ on: false }])
  })

  it('throws what the server rejects and drops it from the queue', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(rejected)
    const pending = usePendingWritesStore()

    await expect(
      pending.commit({ key: 'k', method: 'put', url: '/x', body: {} }, apiClient),
    ).rejects.toBe(rejected)
    expect(pending.count).toBe(0)
  })
})

describe('account options without a connection', () => {
  it('shows the change at once and keeps it even if the server still has the old value', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)
    const auth = useAuthStore()
    auth.user = { ...user }

    const saved = await auth.updateAlertsEnabled(false)

    expect(saved).toBeUndefined()
    expect(auth.user?.alerts_enabled).toBe(false)

    // Al abrir la app con red, el servidor aún trae el valor viejo.
    auth.token = 'a-token'
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...user, alerts_enabled: true } })
    await auth.fetchCurrentUser()
    expect(auth.user?.alerts_enabled).toBe(false)

    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
    await usePendingWritesStore().flush(apiClient)
    expect(apiClient.put).toHaveBeenLastCalledWith(
      '/user/alerts',
      { alerts_enabled: false },
      config,
    )
  })

  it('puts the old value back when the server rejects the change', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(rejected)
    const auth = useAuthStore()
    auth.user = { ...user }

    await expect(auth.updateAlertsEnabled(false)).rejects.toBe(rejected)

    expect(auth.user?.alerts_enabled).toBe(true)
  })
})

describe('baby data without a connection', () => {
  async function storeWithBaby() {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    return store
  }

  it('edits the baby settings and shows them at once', async () => {
    const store = await storeWithBaby()
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)

    await store.updateBaby({ sex: 'nina' })

    expect(store.current?.sex).toBe('nina')
    expect(store.babies.find((b) => b.id === 1)?.sex).toBe('nina')
    expect(usePendingWritesStore().count).toBe(1)
  })

  it('keeps a deleted growth measurement deleted when the server list still has it', async () => {
    const store = await storeWithBaby()
    store.growthMeasurements = [{ id: 5, measured_at: '2026-10-01' } as never]
    vi.mocked(apiClient.delete).mockRejectedValue(noNetwork)

    await store.deleteGrowthMeasurement(5)
    expect(store.growthMeasurements).toEqual([])

    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [{ id: 5, measured_at: '2026-10-01' }] },
    })
    await store.fetchGrowthMeasurements()
    expect(store.growthMeasurements).toEqual([])

    vi.mocked(apiClient.delete).mockResolvedValue({})
    await usePendingWritesStore().flush(apiClient)
    expect(apiClient.delete).toHaveBeenLastCalledWith('/babies/1/growth-measurements/5', config)
  })

  it('puts a measurement back when the server rejects deleting it', async () => {
    const store = await storeWithBaby()
    store.growthMeasurements = [{ id: 5, measured_at: '2026-10-01' } as never]
    vi.mocked(apiClient.delete).mockRejectedValue(rejected)

    await expect(store.deleteGrowthMeasurement(5)).rejects.toBe(rejected)

    expect(store.growthMeasurements.map((m) => m.id)).toEqual([5])
  })

  it('edits a measurement offline', async () => {
    const store = await storeWithBaby()
    store.growthMeasurements = [{ id: 5, measured_at: '2026-10-01', weight_grams: 4000 } as never]
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)

    await store.updateGrowthMeasurement(5, { measured_at: '2026-10-01', weight_grams: 4300 })

    expect(store.growthMeasurements[0]?.weight_grams).toBe(4300)
  })

  it('marks a vitamin D dose offline and keeps it after reading the schedule again', async () => {
    const store = await storeWithBaby()
    store.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: '2026-10-01',
      end_date: '2027-10-01',
    }
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)

    await store.upsertVitaminDDose('2026-10-27', true)
    expect(store.vitaminDRecentDoses.find((d) => d.date === '2026-10-27')?.given).toBe(true)

    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: store.vitaminDSchedule, recent_doses: [] },
    })
    await store.fetchVitaminDSchedule()
    expect(store.vitaminDRecentDoses.find((d) => d.date === '2026-10-27')?.given).toBe(true)
  })

  it('edits and deletes a vaccine and a check-up offline', async () => {
    const store = await storeWithBaby()
    store.vaccinations = [
      { id: 7, name: 'Hexavalente', due_date: '2026-11-01', given_at: null } as never,
    ]
    store.checkups = [{ id: 3, scheduled_at: '2026-11-10T10:00:00Z', reason: null } as never]
    vi.mocked(apiClient.put).mockRejectedValue(noNetwork)
    vi.mocked(apiClient.delete).mockRejectedValue(noNetwork)

    await store.saveVaccination(7, {
      name: 'Hexavalente',
      due_date: '2026-11-01',
      given_at: '2026-11-02',
      notes: null,
    })
    await store.deleteCheckup(3)

    expect(store.vaccinations[0]?.given_at).toBe('2026-11-02')
    expect(store.checkups).toEqual([])
    expect(usePendingWritesStore().count).toBe(2)
  })
})
