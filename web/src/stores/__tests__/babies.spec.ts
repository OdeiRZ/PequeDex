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
  water_broke_at: null,
}

const secondBaby = {
  id: 2,
  name: 'Segundo',
  due_date: null,
  birth_date: '2024-01-10',
  sex: null,
  invite_code: 'EFGH5678',
  water_broke_at: null,
}

describe('useBabiesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
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

  it('loads every baby into `babies`, defaulting current to the first', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [baby, secondBaby] } })
    const store = useBabiesStore()

    await store.fetchCurrent()

    expect(store.babies).toEqual([baby, secondBaby])
    expect(store.current).toEqual(baby)
  })

  it('restores the previously-active baby instead of always the first', async () => {
    localStorage.setItem('pequedex_active_baby', '2')
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [baby, secondBaby] } })
    const store = useBabiesStore()

    await store.fetchCurrent()

    expect(store.current).toEqual(secondBaby)
  })

  it('switches the current baby among the already-loaded ones', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [baby, secondBaby] } })
    const store = useBabiesStore()
    await store.fetchCurrent()

    store.switchBaby(2)

    expect(store.current).toEqual(secondBaby)
    expect(localStorage.getItem('pequedex_active_baby')).toBe('2')
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

  it('fetches the full sleep/feed/diaper history in parallel for the stats page', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/babies/1/sleeps') return Promise.resolve({ data: { data: [{ id: 1 }] } })
      if (url === '/babies/1/feeds') return Promise.resolve({ data: { data: [{ id: 2 }] } })
      if (url === '/babies/1/diaper-changes')
        return Promise.resolve({ data: { data: [{ id: 3 }] } })
      throw new Error(`unexpected GET ${url}`)
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchStatsData()

    expect(store.statsSleeps).toEqual([{ id: 1 }])
    expect(store.statsFeeds).toEqual([{ id: 2 }])
    expect(store.statsDiaperChanges).toEqual([{ id: 3 }])
  })

  it('creates a feed, folding the response into the timeline without refetching it', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 1, started_at: '2026-08-30T10:00:00Z' } },
    })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    await store.createFeed({ type: 'biberon', amount_ml: 120, started_at: '2026-08-30T10:00' })

    expect(apiClient.post).toHaveBeenCalledWith('/babies/1/feeds', {
      type: 'biberon',
      amount_ml: 120,
      started_at: '2026-08-30T10:00',
    })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(store.timeline).toEqual([
      {
        type: 'feed',
        at: '2026-08-30T10:00:00Z',
        data: { id: 1, started_at: '2026-08-30T10:00:00Z' },
      },
    ])
  })

  it('deletes a feed optimistically, without refetching the whole timeline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const store = useBabiesStore()
    await store.create({})
    store.timeline = [
      { type: 'feed', at: '2026-08-30T10:00:00Z', data: { id: 5 } as never },
      { type: 'feed', at: '2026-08-30T09:00:00Z', data: { id: 6 } as never },
    ]
    vi.mocked(apiClient.get).mockClear()

    const pending = store.deleteFeed(5)

    // Removed from `timeline` synchronously, before the request even
    // resolves - the whole point of doing this optimistically instead
    // of waiting on a round-trip plus a full re-fetch.
    expect(store.timeline.map((e) => e.data.id)).toEqual([6])

    await pending

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/feeds/5')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('folds a created/updated sleep into recentSleeps too, not just timeline/dayTimeline', async () => {
    // Real bug found live: WeeklySleep.vue (dashboard) reads
    // `recentSleeps`, which only `fetchRecentSleeps()` ever populated -
    // called once at dashboard mount - so a sleep logged for a past
    // day via the "ritmo" view left that chart stale until a full page
    // reload. `createSleep`/`updateSleep` already folded the response
    // into `timeline`/`dayTimeline`; they needed to do the same here.
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 9, started_at: '2026-08-25T21:00:00Z', ended_at: null } },
    })
    const store = useBabiesStore()
    await store.create({})
    store.recentSleeps = [{ id: 3, started_at: '2026-08-29T10:00:00Z', ended_at: null } as never]

    await store.createSleep({ started_at: '2026-08-25T21:00' })

    // Sorted desc by date, same as upsertByDate already does for
    // growthMeasurements/milestones - the new sleep (25 ago) is older
    // than the existing one (29 ago), so it lands after it.
    expect(store.recentSleeps.map((s) => s.id)).toEqual([3, 9])

    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        data: { id: 9, started_at: '2026-08-25T21:00:00Z', ended_at: '2026-08-26T06:00:00Z' },
      },
    })

    await store.updateSleep(9, { started_at: '2026-08-25T21:00', ended_at: '2026-08-26T06:00' })

    expect(store.recentSleeps.find((s) => s.id === 9)?.ended_at).toBe('2026-08-26T06:00:00Z')
  })

  it('deletes a sleep optimistically from recentSleeps too', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const store = useBabiesStore()
    await store.create({})
    store.recentSleeps = [
      { id: 5, started_at: '2026-08-30T10:00:00Z', ended_at: null } as never,
      { id: 6, started_at: '2026-08-29T10:00:00Z', ended_at: null } as never,
    ]

    await store.deleteSleep(5)

    expect(store.recentSleeps.map((s) => s.id)).toEqual([6])
    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/sleeps/5')
  })

  it('restores recentSleeps if the delete request fails', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('network'))
    const store = useBabiesStore()
    await store.create({})
    store.recentSleeps = [{ id: 5, started_at: '2026-08-30T10:00:00Z', ended_at: null } as never]

    await expect(store.deleteSleep(5)).rejects.toThrow('network')

    expect(store.recentSleeps.map((s) => s.id)).toEqual([5])
  })

  it('folds an updated feed into dayTimeline too, not just timeline', async () => {
    // Real bug found live: editing/deleting an entry several days back
    // only patched `timeline` (always "today"), so a past day's visible
    // list - rendered from `dayTimeline` - kept showing the stale
    // version until navigating away and back forced a refetch.
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.put).mockResolvedValue({
      data: { data: { id: 7, started_at: '2026-08-25T10:00:00Z', amount_ml: 150 } },
    })
    const store = useBabiesStore()
    await store.create({})
    store.dayTimeline = [
      { type: 'feed', at: '2026-08-25T10:00:00Z', data: { id: 7, amount_ml: 90 } as never },
    ]

    await store.updateFeed(7, { type: 'biberon', amount_ml: 150, started_at: '2026-08-25T10:00' })

    expect(store.dayTimeline).toEqual([
      {
        type: 'feed',
        at: '2026-08-25T10:00:00Z',
        data: { id: 7, started_at: '2026-08-25T10:00:00Z', amount_ml: 150 },
      },
    ])
  })

  it('removes a deleted feed from dayTimeline too, not just timeline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const store = useBabiesStore()
    await store.create({})
    store.dayTimeline = [
      { type: 'feed', at: '2026-08-25T10:00:00Z', data: { id: 5 } as never },
      { type: 'feed', at: '2026-08-25T09:00:00Z', data: { id: 6 } as never },
    ]

    await store.deleteFeed(5)

    expect(store.dayTimeline.map((e) => e.data.id)).toEqual([6])
  })

  it('restores the timeline if deleting a feed fails', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('network error'))
    const store = useBabiesStore()
    await store.create({})
    const original = [
      { type: 'feed' as const, at: '2026-08-30T10:00:00Z', data: { id: 5 } as never },
    ]
    store.timeline = original

    await expect(store.deleteFeed(5)).rejects.toThrow('network error')

    expect(store.timeline).toEqual(original)
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

  it('leaves the current baby, clearing it locally', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    const store = useBabiesStore()
    await store.create({})

    await store.leave()

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/leave')
    expect(store.current).toBeNull()
  })

  it('falls back to another already-loaded baby when leaving, instead of always going to null', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: [baby, secondBaby] } })
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    const store = useBabiesStore()
    await store.fetchCurrent()

    await store.leave()

    expect(store.babies).toEqual([secondBaby])
    expect(store.current).toEqual(secondBaby)
    expect(localStorage.getItem('pequedex_active_baby')).toBe('2')
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

  it('creates a growth measurement, folding the response into the list without refetching it', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 1, measured_at: '2026-08-30', weight_grams: 4200 } },
    })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    await store.createGrowthMeasurement({ measured_at: '2026-08-30', weight_grams: 4200 })

    expect(apiClient.post).toHaveBeenCalledWith('/babies/1/growth-measurements', {
      measured_at: '2026-08-30',
      weight_grams: 4200,
    })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(store.growthMeasurements).toEqual([
      { id: 1, measured_at: '2026-08-30', weight_grams: 4200 },
    ])
  })

  it('deletes a growth measurement optimistically, without refetching the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const store = useBabiesStore()
    await store.create({})
    store.growthMeasurements = [{ id: 5 } as never, { id: 6 } as never]
    vi.mocked(apiClient.get).mockClear()

    const pending = store.deleteGrowthMeasurement(5)

    expect(store.growthMeasurements.map((m) => m.id)).toEqual([6])

    await pending

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/growth-measurements/5')
    expect(apiClient.get).not.toHaveBeenCalled()
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

  it('creates a milestone as multipart form data, folding the response in without refetching', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 1, achieved_at: '2026-08-30', title: 'Primer diente' } },
    })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    await store.createMilestone({ achieved_at: '2026-08-30', title: 'Primer diente' })

    expect(apiClient.post).toHaveBeenLastCalledWith('/babies/1/milestones', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(store.milestones).toEqual([{ id: 1, achieved_at: '2026-08-30', title: 'Primer diente' }])
  })

  it('deletes a milestone optimistically, without refetching the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.delete).mockResolvedValue({})
    const store = useBabiesStore()
    await store.create({})
    store.milestones = [{ id: 5 } as never, { id: 6 } as never]
    vi.mocked(apiClient.get).mockClear()

    const pending = store.deleteMilestone(5)

    expect(store.milestones.map((m) => m.id)).toEqual([6])

    await pending

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/milestones/5')
    expect(apiClient.get).not.toHaveBeenCalled()
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

  it('fetches the feed prediction for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: { has_enough_data: false, sample_size: 1, minimum_sample_size: 3, prediction: null },
      },
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchFeedPrediction()

    expect(store.feedPrediction?.has_enough_data).toBe(false)
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/feed-prediction')
  })

  it('fetches contractions for the current baby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const contraction = {
      id: 1,
      baby_id: 1,
      user_id: 1,
      started_at: '2026-09-16T15:13:00Z',
      ended_at: null,
      intensity: 0,
    }
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [contraction] } })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchContractions()

    expect(store.contractions).toEqual([contraction])
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/contractions')
  })

  it('starts a contraction and pushes it onto the front of the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    const started = {
      id: 1,
      baby_id: 1,
      user_id: 1,
      started_at: '2026-09-16T15:13:00Z',
      ended_at: null,
      intensity: 0,
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: started } })

    const result = await store.startContraction()

    expect(result).toEqual(started)
    expect(store.contractions).toEqual([started])
    expect(apiClient.post).toHaveBeenCalledWith('/babies/1/contractions')
  })

  it('updates a contraction in place (used both to stop it and to edit it)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.contractions = [
      {
        id: 1,
        baby_id: 1,
        user_id: 1,
        started_at: '2026-09-16T15:13:00Z',
        ended_at: null,
        intensity: 0,
      },
    ]

    const stopped = {
      id: 1,
      baby_id: 1,
      user_id: 1,
      started_at: '2026-09-16T15:13:00Z',
      ended_at: '2026-09-16T15:13:33Z',
      intensity: 1,
    }
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: stopped } })

    await store.updateContraction(1, {
      started_at: '2026-09-16T15:13:00Z',
      ended_at: '2026-09-16T15:13:33Z',
      intensity: 1,
    })

    expect(store.contractions).toEqual([stopped])
    expect(apiClient.put).toHaveBeenCalledWith('/babies/1/contractions/1', {
      started_at: '2026-09-16T15:13:00Z',
      ended_at: '2026-09-16T15:13:33Z',
      intensity: 1,
    })
  })

  it('deletes a contraction locally after the request succeeds', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.contractions = [
      {
        id: 1,
        baby_id: 1,
        user_id: 1,
        started_at: '2026-09-16T15:13:00Z',
        ended_at: null,
        intensity: 0,
      },
    ]
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await store.deleteContraction(1)

    expect(store.contractions).toEqual([])
    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/contractions/1')
  })

  it('deletes every contraction locally after the bulk request succeeds', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.contractions = [
      {
        id: 1,
        baby_id: 1,
        user_id: 1,
        started_at: '2026-09-16T15:13:00Z',
        ended_at: null,
        intensity: 0,
      },
      {
        id: 2,
        baby_id: 1,
        user_id: 1,
        started_at: '2026-09-16T15:20:00Z',
        ended_at: null,
        intensity: 1,
      },
    ]
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await store.deleteAllContractions()

    expect(store.contractions).toEqual([])
    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/contractions')
  })

  it('sets water_broke_at via updateBaby', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    const withBreak = { ...baby, water_broke_at: '2026-09-20T17:24:00Z' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: withBreak } })

    await store.updateBaby({ water_broke_at: '2026-09-20T17:24:00Z' })

    expect(store.current?.water_broke_at).toBe('2026-09-20T17:24:00Z')
    expect(apiClient.put).toHaveBeenCalledWith('/babies/1', {
      water_broke_at: '2026-09-20T17:24:00Z',
    })
  })

  it('fetches the vitamin D schedule and its recent doses', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: {
          id: 1,
          baby_id: 1,
          enabled: true,
          start_date: '2026-10-01',
          end_date: '2027-10-01',
        },
        recent_doses: [{ id: 1, baby_id: 1, date: '2026-10-08', given: true }],
      },
    })

    await store.fetchVitaminDSchedule()

    expect(store.vitaminDSchedule?.enabled).toBe(true)
    expect(store.vitaminDRecentDoses).toEqual([
      { id: 1, baby_id: 1, date: '2026-10-08', given: true },
    ])
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/vitamin-d-schedule')
  })

  it('upserts the vitamin D schedule', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        data: {
          id: 1,
          baby_id: 1,
          enabled: false,
          start_date: '2026-10-01',
          end_date: '2027-10-01',
        },
      },
    })

    await store.upsertVitaminDSchedule({
      enabled: false,
      start_date: '2026-10-01',
      end_date: '2027-10-01',
    })

    expect(store.vitaminDSchedule?.enabled).toBe(false)
    expect(apiClient.put).toHaveBeenCalledWith('/babies/1/vitamin-d-schedule', {
      enabled: false,
      start_date: '2026-10-01',
      end_date: '2027-10-01',
    })
  })

  it('upserts a vitamin D dose into both recent and all-doses lists, sorted desc by date', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: '2026-10-07', given: true }]
    store.vitaminDAllDoses = [{ id: 1, baby_id: 1, date: '2026-10-07', given: true }]

    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { data: { id: 2, baby_id: 1, date: '2026-10-08', given: false } },
    })

    await store.upsertVitaminDDose('2026-10-08', false)

    expect(store.vitaminDRecentDoses.map((d) => d.id)).toEqual([2, 1])
    expect(store.vitaminDAllDoses.map((d) => d.id)).toEqual([2, 1])
    expect(apiClient.put).toHaveBeenCalledWith('/babies/1/vitamin-d-doses', {
      date: '2026-10-08',
      given: false,
    })
  })

  it('fetches the full vitamin D dose history, unbounded by the 14-day recent window', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { data: [{ id: 1, baby_id: 1, date: '2026-08-01', given: true }] },
    })

    await store.fetchAllVitaminDDoses()

    expect(store.vitaminDAllDoses).toEqual([{ id: 1, baby_id: 1, date: '2026-08-01', given: true }])
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/vitamin-d-doses')
  })
})
