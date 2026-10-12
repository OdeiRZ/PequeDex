import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { SNAPSHOT_KEY, buildSnapshot, loadSnapshot, saveSnapshot } from '@/lib/snapshot'
import { SNAPSHOT_DEBOUNCE_MS, startSnapshotSync } from '@/lib/snapshotSync'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore, type Baby, type BabiesSnapshotData } from '@/stores/babies'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const TOKEN = 'token-abcdefghijklmnop'
const baby = { id: 7, name: 'Peque', birth_date: '2026-09-17' } as Baby
const savedData = {
  timeline: [{ type: 'feed', at: '2026-10-12T08:00:00Z', data: { id: 1 } }],
  growthMeasurements: [],
  milestones: [],
  sleepPrediction: null,
  feedPrediction: null,
  vitaminDSchedule: null,
  vitaminDRecentDoses: [],
  temperatures: [],
  recentDiaperChanges: [],
  vaccinations: [],
  vaccinationTemplate: null,
  checkups: [],
} as unknown as BabiesSnapshotData

describe('snapshot hydration and sync', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts the stores from the saved snapshot of this session', () => {
    localStorage.setItem('pequedex_token', TOKEN)
    saveSnapshot(buildSnapshot(TOKEN, { id: 1, name: 'Odei' } as never, [baby], baby.id, savedData))
    setActivePinia(createPinia())

    const babies = useBabiesStore()
    const auth = useAuthStore()

    expect(babies.hydratedFromSnapshot).toBe(true)
    expect(babies.current?.id).toBe(7)
    expect(babies.timeline).toHaveLength(1)
    expect(auth.user?.name).toBe('Odei')
  })

  it('does not hydrate from another session or without a token', () => {
    saveSnapshot(buildSnapshot('token-de-otra-cuenta-xyz', null, [baby], baby.id, savedData))
    localStorage.setItem('pequedex_token', TOKEN)
    setActivePinia(createPinia())
    expect(useBabiesStore().hydratedFromSnapshot).toBe(false)
    expect(useBabiesStore().timeline).toEqual([])

    localStorage.removeItem('pequedex_token')
    saveSnapshot(buildSnapshot(TOKEN, null, [baby], baby.id, savedData))
    setActivePinia(createPinia())
    expect(useBabiesStore().hydratedFromSnapshot).toBe(false)
  })

  it('does not mix the history of the snapshot baby into a different current baby', () => {
    localStorage.setItem('pequedex_token', TOKEN)
    localStorage.setItem('pequedex_active_baby', '8')
    const other = { id: 8 } as Baby
    saveSnapshot(buildSnapshot(TOKEN, null, [baby, other], baby.id, savedData))
    setActivePinia(createPinia())

    const babies = useBabiesStore()

    expect(babies.current?.id).toBe(8)
    expect(babies.hydratedFromSnapshot).toBe(false)
    expect(babies.timeline).toEqual([])
  })

  it('saves the snapshot after changes, debounced, once the data is fresh', async () => {
    localStorage.setItem('pequedex_token', TOKEN)
    const pinia = createPinia()
    setActivePinia(pinia)
    const babies = useBabiesStore()
    const auth = useAuthStore()
    startSnapshotSync(pinia)

    babies.babies = [baby]
    babies.current = baby
    babies.timeline = savedData.timeline
    auth.user = { id: 1, name: 'Odei' } as never
    await nextTick()

    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull()
    vi.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS + 10)

    const saved = loadSnapshot(TOKEN)
    expect(saved?.currentId).toBe(7)
    expect(saved?.data.timeline).toHaveLength(1)
  })

  it('does not renew the snapshot while it is still the stale one on screen', async () => {
    localStorage.setItem('pequedex_token', TOKEN)
    const savedAt = Date.now() - 60_000
    saveSnapshot(buildSnapshot(TOKEN, null, [baby], baby.id, savedData, savedAt))
    const pinia = createPinia()
    setActivePinia(pinia)
    const babies = useBabiesStore()
    startSnapshotSync(pinia)
    expect(babies.hydratedFromSnapshot).toBe(true)

    babies.timeline = []
    await nextTick()
    vi.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS + 10)

    // Sigue la foto original, sin tocar.
    expect(JSON.parse(localStorage.getItem(SNAPSHOT_KEY)!).savedAt).toBe(savedAt)
  })

  it('clears the snapshot when the session ends', () => {
    localStorage.setItem('pequedex_token', TOKEN)
    saveSnapshot(buildSnapshot(TOKEN, null, [baby], baby.id, savedData))
    setActivePinia(createPinia())
    const auth = useAuthStore()

    auth.clearSession()

    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull()
  })
})
