import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBabiesStore } from '@/stores/babies'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const baby = {
  id: 1,
  name: 'Peque',
  due_date: '2026-09-15',
  birth_date: null,
  sex: null,
  invite_code: 'ABCD1234',
}

describe('useBabiesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it("fetches the user's own baby, if any", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [baby] } })
    const store = useBabiesStore()

    await store.fetchCurrent()

    expect(store.current).toEqual(baby)
  })

  it('sets current to null when the user has no baby yet', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()

    await store.fetchCurrent()

    expect(store.current).toBeNull()
  })

  it('creates a baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    const store = useBabiesStore()

    await store.create({ name: 'Peque', due_date: '2026-09-15' })

    expect(store.current).toEqual(baby)
    expect(apiClient.post).toHaveBeenCalledWith('/babies', {
      name: 'Peque',
      due_date: '2026-09-15',
    })
  })

  it('joins a baby using an invite code', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    const store = useBabiesStore()

    await store.join('ABCD1234')

    expect(store.current).toEqual(baby)
    expect(apiClient.post).toHaveBeenCalledWith('/babies/join', { invite_code: 'ABCD1234' })
  })

  it('fetches the timeline for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [{ type: 'feed', at: '2026-08-30T10:00:00Z', data: { id: 1 } }] },
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchTimeline()

    expect(store.timeline).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/timeline')
  })

  it('creates a feed and refetches the timeline', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { id: 1 } } })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.createFeed({ type: 'biberon', amount_ml: 120, started_at: '2026-08-30T10:00' })

    expect(apiClient.post).toHaveBeenCalledWith('/babies/1/feeds', {
      type: 'biberon',
      amount_ml: 120,
      started_at: '2026-08-30T10:00',
    })
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/timeline')
  })

  it('deletes a feed and refetches the timeline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.deleteFeed(5)

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/feeds/5')
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/timeline')
  })

  it('regenerates the invite code', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const rotated = { ...baby, invite_code: 'NEWCODE1' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: rotated } })
    const store = useBabiesStore()
    await store.create({})

    await store.regenerateInviteCode()

    expect(store.current?.invite_code).toBe('NEWCODE1')
  })

  it('updates the baby (sex/birth_date)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const updated = { ...baby, sex: 'nino', birth_date: '2026-09-01' }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { data: updated } })
    const store = useBabiesStore()
    await store.create({})

    await store.updateBaby({ sex: 'nino', birth_date: '2026-09-01' })

    expect(store.current).toEqual(updated)
    expect(apiClient.put).toHaveBeenCalledWith('/babies/1', {
      sex: 'nino',
      birth_date: '2026-09-01',
    })
  })

  it('fetches growth measurements for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 1, weight_grams: 4200 }] } })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchGrowthMeasurements()

    expect(store.growthMeasurements).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/growth-measurements')
  })

  it('creates a growth measurement and refetches the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { id: 1 } } })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.createGrowthMeasurement({ measured_at: '2026-08-30', weight_grams: 4200 })

    expect(apiClient.post).toHaveBeenCalledWith('/babies/1/growth-measurements', {
      measured_at: '2026-08-30',
      weight_grams: 4200,
    })
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/growth-measurements')
  })

  it('deletes a growth measurement and refetches the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.deleteGrowthMeasurement(5)

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/growth-measurements/5')
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/growth-measurements')
  })

  it('fetches milestones for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [{ id: 1, title: 'Primer diente' }] },
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchMilestones()

    expect(store.milestones).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/milestones')
  })

  it('creates a milestone as multipart form data and refetches the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { id: 1 } } })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.createMilestone({ achieved_at: '2026-08-30', title: 'Primer diente' })

    expect(apiClient.post).toHaveBeenLastCalledWith('/babies/1/milestones', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/milestones')
  })

  it('deletes a milestone and refetches the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })
    const store = useBabiesStore()
    await store.create({})

    await store.deleteMilestone(5)

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/milestones/5')
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/milestones')
  })

  it('fetches the sleep prediction for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: { has_enough_data: false, sample_size: 1, minimum_sample_size: 3, prediction: null },
      },
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchSleepPrediction()

    expect(store.sleepPrediction?.has_enough_data).toBe(false)
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/sleep-prediction')
  })
})
