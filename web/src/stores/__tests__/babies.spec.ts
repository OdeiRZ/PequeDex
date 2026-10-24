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
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/timeline', expect.anything())
  })

  it('fetches the full sleep/feed/diaper/temperature history in parallel for the stats page', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/babies/1/sleeps') return Promise.resolve({ data: { data: [{ id: 1 }] } })
      if (url === '/babies/1/feeds') return Promise.resolve({ data: { data: [{ id: 2 }] } })
      if (url === '/babies/1/diaper-changes')
        return Promise.resolve({ data: { data: [{ id: 3 }] } })
      if (url === '/babies/1/temperatures') return Promise.resolve({ data: { data: [{ id: 4 }] } })
      throw new Error(`unexpected GET ${url}`)
    })
    const store = useBabiesStore()
    await store.create({})

    await store.fetchStatsData()

    expect(store.statsSleeps).toEqual([{ id: 1 }])
    expect(store.statsFeeds).toEqual([{ id: 2 }])
    expect(store.statsDiaperChanges).toEqual([{ id: 3 }])
    expect(store.statsTemperatures).toEqual([{ id: 4 }])
  })

  it('folds a new temperature into the timeline and the recent temperatures list', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    const temperature = {
      id: 9,
      baby_id: 1,
      user_id: 1,
      measured_at: '2026-10-11T08:00:00Z',
      celsius: 38.1,
      method: null,
      notes: null,
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: temperature } })
    await store.createTemperature({ measured_at: temperature.measured_at, celsius: 38.1 })

    expect(store.timeline[0]).toEqual({
      type: 'temperature',
      at: temperature.measured_at,
      data: temperature,
    })
    expect(store.temperatures).toEqual([temperature])

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await store.deleteTemperature(9)

    expect(store.timeline).toEqual([])
    expect(store.temperatures).toEqual([])
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

    expect(apiClient.post).toHaveBeenCalledWith(
      '/babies/1/feeds',
      {
        type: 'biberon',
        amount_ml: 120,
        started_at: '2026-08-30T10:00',
        client_uuid: expect.any(String),
      },
      // El envío por detrás no espera eternamente: 20 s dan margen a que Render
      // despierte la API y, si la conexión está muerta, se reintenta en el sondeo.
      { timeout: 20000, signal: expect.any(AbortSignal) },
    )
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(store.timeline).toEqual([
      {
        type: 'feed',
        at: '2026-08-30T10:00:00Z',
        data: { id: 1, started_at: '2026-08-30T10:00:00Z' },
      },
    ])
  })

  it('queues a log when there is no connection and sends it later with the same client_uuid', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineQueue = []

    vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    const result = await store.createDiaperChange({
      changed_at: '2026-10-12T08:00:00Z',
      type: 'mojado',
    })

    expect(result).toBe('queued')
    expect(store.offlineQueue).toHaveLength(1)
    expect(store.timeline[0]).toMatchObject({ type: 'diaper_change', pending: expect.any(String) })
    const queuedUuid = store.offlineQueue[0]!.clientUuid

    const saved = {
      id: 42,
      baby_id: 1,
      user_id: 1,
      changed_at: '2026-10-12T08:00:00Z',
      type: 'mojado',
      residue_color: null,
      size: null,
      notes: null,
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: saved } })
    const outcome = await store.flushOfflineQueue()

    expect(outcome).toEqual({ sent: 1, rejected: 0 })
    expect(apiClient.post).toHaveBeenLastCalledWith(
      '/babies/1/diaper-changes',
      {
        changed_at: '2026-10-12T08:00:00Z',
        type: 'mojado',
        client_uuid: queuedUuid,
      },
      { timeout: 20000, signal: expect.any(AbortSignal) },
    )
    expect(store.offlineQueue).toEqual([])
    expect(store.timeline).toEqual([{ type: 'diaper_change', at: saved.changed_at, data: saved }])
  })

  it('keeps the queue on a network error during flush and drops a rejected log', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineQueue = []

    vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    await store.createTemperature({ measured_at: '2026-10-12T08:00:00Z', celsius: 37.5 })

    vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    expect(await store.flushOfflineQueue()).toEqual({ sent: 0, rejected: 0 })
    expect(store.offlineQueue).toHaveLength(1)

    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 422 },
    })
    expect(await store.flushOfflineQueue()).toEqual({ sent: 0, rejected: 1 })
    expect(store.offlineQueue).toEqual([])
    expect(store.timeline).toEqual([])
  })

  it('queues finishing an already-saved sleep offline, shows it, and sends the PUT later', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineUpdates = []
    const ongoing = { id: 9, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
    store.timeline = [{ type: 'sleep', at: ongoing.started_at, data: ongoing as never }]

    vi.mocked(apiClient.put).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    const payload = { started_at: ongoing.started_at, ended_at: '2026-10-12T09:00:00Z' }
    expect(await store.updateSleep(9, payload)).toBe('queued')
    expect(store.offlineUpdates).toHaveLength(1)
    expect((store.timeline[0]!.data as { ended_at: string }).ended_at).toBe(payload.ended_at)

    // Sin red otra vez: sigue en cola.
    vi.mocked(apiClient.put).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    expect(await store.flushOfflineQueue()).toEqual({ sent: 0, rejected: 0 })
    expect(store.offlineUpdates).toHaveLength(1)

    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { data: { ...ongoing, ...payload } } })
    expect(await store.flushOfflineQueue()).toEqual({ sent: 1, rejected: 0 })
    expect(apiClient.put).toHaveBeenLastCalledWith('/babies/1/sleeps/9', payload, {
      timeout: 20000,
      signal: expect.any(AbortSignal),
    })
    expect(store.offlineUpdates).toEqual([])
  })

  it('loads the whole dashboard with a single bootstrap request', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    const feed = { id: 3, started_at: '2026-10-12T08:00:00Z' }
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        timeline: { data: [{ type: 'feed', at: feed.started_at, data: feed }] },
        growth_measurements: { data: [{ id: 1 }] },
        milestones: { data: [{ id: 2 }] },
        sleep_prediction: { data: { has_enough_data: false } },
        feed_prediction: { data: { has_enough_data: true } },
        vitamin_d_schedule: { data: { id: 4 }, recent_doses: [{ id: 5 }] },
        temperatures: { data: [{ id: 6 }] },
        recent_diaper_changes: { data: [{ id: 7 }] },
      },
    })

    await store.fetchBootstrap()

    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/babies/1/bootstrap',
      expect.objectContaining({ params: expect.objectContaining({ tz: expect.any(String) }) }),
    )
    expect(store.timeline).toEqual([{ type: 'feed', at: feed.started_at, data: feed }])
    expect(store.growthMeasurements).toEqual([{ id: 1 }])
    expect(store.milestones).toEqual([{ id: 2 }])
    expect(store.feedPrediction?.has_enough_data).toBe(true)
    expect(store.vitaminDSchedule).toEqual({ id: 4 })
    expect(store.vitaminDRecentDoses).toEqual([{ id: 5 }])
    expect(store.temperatures).toEqual([{ id: 6 }])
    expect(store.recentDiaperChanges).toEqual([{ id: 7 }])
    // Sin vacunas activadas en la respuesta: se vacían las del bebé anterior.
    expect(store.vaccinations).toEqual([])
    expect(store.checkups).toEqual([])
  })

  it('polls the timeline conditionally and leaves it alone on a 304', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    const entries = [{ type: 'feed', at: '2026-10-12T08:00:00Z', data: { id: 3 } }]
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 200,
      headers: { etag: '"v1"' },
      data: { data: entries },
    })
    await store.fetchTimeline()
    expect(store.timeline).toEqual(entries)
    // La primera vez no hay huella que enviar.
    expect(vi.mocked(apiClient.get).mock.calls[0]![1]).toMatchObject({ headers: undefined })

    // Sin cambios: 304, la lista no se toca (ni se vuelve a asignar).
    const before = store.timeline
    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 304, headers: { etag: '"v1"' } })
    await store.fetchTimeline()
    expect(vi.mocked(apiClient.get).mock.calls[1]![1]).toMatchObject({
      headers: { 'If-None-Match': '"v1"' },
    })
    expect(store.timeline).toBe(before)

    // Con cambios: lista nueva y huella nueva.
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 200,
      headers: { etag: '"v2"' },
      data: { data: [] },
    })
    await store.fetchTimeline()
    expect(store.timeline).toEqual([])
    expect(store.timelineEtag).toBe('"v2"')

    // `force` salta el condicional.
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 200,
      headers: { etag: '"v2"' },
      data: { data: entries },
    })
    await store.fetchTimeline(true)
    expect(vi.mocked(apiClient.get).mock.calls[3]![1]).toMatchObject({ headers: undefined })
    expect(store.timeline).toEqual(entries)
  })

  it('joins a timeline request already in flight instead of stacking another', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    let answer!: (value: unknown) => void
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    const first = store.fetchTimeline()
    const second = store.fetchTimeline()
    expect(apiClient.get).toHaveBeenCalledTimes(1)

    answer({ status: 200, headers: { etag: '"v1"' }, data: { data: [] } })
    await Promise.all([first, second])

    // Terminada, la siguiente sí sale; y `force` no se une a una condicional.
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}))
    void store.fetchTimeline()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, headers: {}, data: { data: [] } })
    await store.fetchTimeline(true)
    expect(apiClient.get).toHaveBeenCalledTimes(3)
  })

  it('takes the first conditional token from the bootstrap', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        timeline: { data: [] },
        timeline_etag: '"boot"',
        growth_measurements: { data: [] },
        milestones: { data: [] },
        sleep_prediction: { data: {} },
        feed_prediction: { data: {} },
        vitamin_d_schedule: { data: null, recent_doses: [] },
        temperatures: { data: [] },
        recent_diaper_changes: { data: [] },
      },
    })
    await store.fetchBootstrap()

    expect(store.timelineEtag).toBe('"boot"')
  })

  describe('conditional and parallel bootstrap', () => {
    const body = () => ({
      timeline: { data: [{ type: 'feed', at: '2026-10-12T08:00:00Z', data: { id: 9 } }] },
      timeline_etag: '"t1"',
      growth_measurements: { data: [] },
      milestones: { data: [] },
      sleep_prediction: { data: {} },
      feed_prediction: { data: {} },
      vitamin_d_schedule: { data: null, recent_doses: [] },
      temperatures: { data: [] },
      recent_diaper_changes: { data: [] },
    })

    async function storeWithBaby() {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
      const store = useBabiesStore()
      await store.create({})
      vi.mocked(apiClient.get).mockReset()
      return store
    }

    it('stores the etag of a fresh bootstrap and sends it next time; a 304 changes nothing', async () => {
      const store = await storeWithBaby()

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        headers: { etag: '"b1"' },
        data: body(),
      })
      await store.fetchBootstrap()
      expect(store.bootstrapEtag).toBe('"b1"')
      expect(vi.mocked(apiClient.get).mock.calls[0]![1]).toMatchObject({ headers: undefined })

      const before = store.timeline
      store.hydratedFromSnapshot = true
      vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 304, headers: { etag: '"b1"' } })
      await store.fetchBootstrap()

      expect(vi.mocked(apiClient.get).mock.calls[1]![1]).toMatchObject({
        headers: { 'If-None-Match': '"b1"' },
      })
      // 304: lo que ya había sigue siendo lo último, y ya no es "solo la foto".
      expect(store.timeline).toBe(before)
      expect(store.hydratedFromSnapshot).toBe(false)
      expect(store.bootstrapEtag).toBe('"b1"')
    })

    it('keeps the bootstrap etag in the snapshot data', async () => {
      const store = await storeWithBaby()
      store.bootstrapEtag = '"guardado"'

      expect(store.snapshotData().bootstrapEtag).toBe('"guardado"')
    })

    it('starts the dashboard request in parallel and reuses it when the baby matches', async () => {
      const store = await storeWithBaby()
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        status: 200,
        headers: { etag: '"p1"' },
        data: body(),
      })

      const early = store.startEarlyBootstrap()
      expect(early?.babyId).toBe(baby.id)
      await store.fetchBootstrap(early)

      // Una sola petición del arranque, no una más tras esperar.
      expect(apiClient.get).toHaveBeenCalledTimes(1)
      expect(store.bootstrapEtag).toBe('"p1"')
      expect(store.timeline).toHaveLength(1)
    })

    it('ignores a parallel request made for another baby and asks again', async () => {
      const store = await storeWithBaby()
      vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data: body() }) // la temprana (otro bebé)
      vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data: body() })

      const early = store.startEarlyBootstrap()!
      early.babyId = 999
      await store.fetchBootstrap(early)

      expect(apiClient.get).toHaveBeenCalledTimes(2)
      expect(vi.mocked(apiClient.get).mock.calls[1]![0]).toBe(`/babies/${baby.id}/bootstrap`)
    })

    it('asks again when the parallel request failed', async () => {
      const store = await storeWithBaby()
      vi.mocked(apiClient.get).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
      vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data: body() })

      const early = store.startEarlyBootstrap()
      await store.fetchBootstrap(early)

      expect(apiClient.get).toHaveBeenCalledTimes(2)
      expect(store.timeline).toHaveLength(1)
    })

    it('does not start in parallel while offline logs are pending, nor without a known baby', async () => {
      const store = await storeWithBaby()
      store.offlineQueue = [
        { clientUuid: 'x', tempId: -1, babyId: 1, type: 'feed', payload: {}, queuedAt: '' },
      ]
      expect(store.startEarlyBootstrap()).toBeNull()

      store.offlineQueue = []
      store.current = null
      localStorage.removeItem('pequedex_active_baby')
      expect(store.startEarlyBootstrap()).toBeNull()
    })
  })

  it('keeps queued offline entries and deletes when applying the bootstrap', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineQueue = []
    store.offlineUpdates = []
    store.queueDelete('temperature', 6)

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        timeline: { data: [] },
        growth_measurements: { data: [] },
        milestones: { data: [] },
        sleep_prediction: { data: {} },
        feed_prediction: { data: {} },
        vitamin_d_schedule: { data: null, recent_doses: [] },
        temperatures: { data: [{ id: 6, measured_at: '2026-10-12T08:00:00Z' }] },
        recent_diaper_changes: { data: [] },
      },
    })

    await store.fetchBootstrap()

    // La temperatura 6 está borrada sin conexión: no reaparece.
    expect(store.temperatures).toEqual([])
  })

  it('falls back to the separate requests when the backend has no bootstrap yet', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    vi.mocked(apiClient.get).mockClear()

    vi.mocked(apiClient.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } })

    await store.fetchBootstrap()

    const urls = vi.mocked(apiClient.get).mock.calls.map((call) => call[0])
    expect(urls).toContain('/babies/1/timeline')
    expect(urls).toContain('/babies/1/milestones')
    expect(urls).toContain('/babies/1/feed-prediction')
  })

  it('rethrows a real error from the bootstrap instead of falling back', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})

    vi.mocked(apiClient.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500 },
    })

    await expect(store.fetchBootstrap()).rejects.toBeTruthy()
  })

  it('queues deleting a saved log offline, keeps it hidden on refetch, and sends the DELETE later', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineUpdates = []
    const row = { id: 5, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
    store.timeline = [{ type: 'feed', at: row.started_at, data: row as never }]

    vi.mocked(apiClient.delete).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    await store.deleteFeed(5)
    expect(store.timeline).toEqual([])
    expect(store.offlineUpdates).toMatchObject([{ type: 'feed', targetId: 5, action: 'delete' }])

    // El sondeo sigue trayendo el registro: no reaparece.
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { data: [{ type: 'feed', at: row.started_at, data: row }] },
    })
    await store.fetchTimeline()
    expect(store.timeline).toEqual([])

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    expect(await store.flushOfflineQueue()).toEqual({ sent: 1, rejected: 0 })
    expect(apiClient.delete).toHaveBeenLastCalledWith('/babies/1/feeds/5', {
      timeout: 20000,
      signal: expect.any(AbortSignal),
    })
    expect(store.offlineUpdates).toEqual([])
  })

  it('counts a 404 on a queued delete as done', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineUpdates = []
    store.queueDelete('sleep', 8)

    vi.mocked(apiClient.delete).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    expect(await store.flushOfflineQueue()).toEqual({ sent: 1, rejected: 0 })
    expect(store.offlineUpdates).toEqual([])
  })

  it('queues a form edit when there is no connection instead of failing (local first)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineUpdates = []

    vi.mocked(apiClient.put).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
    const payload = { started_at: '2026-10-12T08:00:00Z', ended_at: null }

    expect(await store.updateSleep(9, payload)).toBe('queued')
    expect(store.offlineUpdates).toHaveLength(1)
    expect(store.offlineUpdates[0]).toMatchObject({ type: 'sleep', targetId: 9, payload })
  })

  it.each([
    ['diaper_change', 'diaper-changes', 'updateDiaperChange', 'recentDiaperChanges'],
    ['temperature', 'temperatures', 'updateTemperature', 'temperatures'],
  ] as const)(
    'edits a %s locally first: shows it at once, sends the PUT later',
    async (type, path, action, listKey) => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
      const store = useBabiesStore()
      await store.create({})
      const original =
        type === 'diaper_change'
          ? { id: 4, changed_at: '2026-10-12T08:00:00Z', type: 'mojado' }
          : { id: 4, measured_at: '2026-10-12T08:00:00Z', celsius: 36.5 }
      ;(store as unknown as Record<string, unknown[]>)[listKey] = [original]
      store.offlineUpdates = []

      vi.mocked(apiClient.put).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
      const edit = type === 'diaper_change' ? { type: 'sucio' } : { celsius: 38.1 }
      const payload = { ...original, ...edit } as never

      expect(
        await (store as never as Record<string, (...a: unknown[]) => unknown>)[action]!(4, payload),
      ).toBe('queued')
      // Ya se ve editado en la lista plana, sin esperar al servidor...
      expect((store as unknown as Record<string, unknown[]>)[listKey]![0]).toMatchObject(edit)
      expect(store.offlineUpdates[0]).toMatchObject({ type, targetId: 4 })

      // ...y al volver la red se envía el PUT y la cola se vacía.
      vi.mocked(apiClient.put).mockResolvedValue({ data: { data: { ...original, ...edit } } })
      await store.flushOfflineQueue()
      expect(apiClient.put).toHaveBeenLastCalledWith(
        `/babies/1/${path}/4`,
        payload,
        expect.objectContaining({ timeout: 20000 }),
      )
      expect(store.offlineUpdates).toEqual([])
    },
  )

  it('keeps a pending edit in a flat list when the server list is refreshed', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineUpdates = [
      {
        babyId: 1,
        type: 'temperature',
        targetId: 4,
        payload: { celsius: 38.1 },
        queuedAt: '2026-10-12T09:00:00Z',
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { data: [{ id: 4, measured_at: '2026-10-12T08:00:00Z', celsius: 36.5 }] },
    })

    await store.fetchTemperatures()

    expect(store.temperatures[0]).toMatchObject({ id: 4, celsius: 38.1 })
  })

  it('aborting a stuck send keeps everything queued and lets the next send deliver it', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineQueue = [
      {
        clientUuid: 'u1',
        tempId: -1,
        babyId: 1,
        type: 'diaper_change',
        payload: { changed_at: '2026-10-12T08:00:00Z', type: 'mojado' },
        queuedAt: '2026-10-12T08:00:00Z',
      },
    ]

    // La primera petición se queda colgada hasta que se corta su señal.
    vi.mocked(apiClient.post).mockImplementationOnce(
      (_url, _body, config) =>
        new Promise((_resolve, reject) => {
          ;(config?.signal as AbortSignal | undefined)?.addEventListener('abort', () =>
            reject({ isAxiosError: true, code: 'ERR_CANCELED' }),
          )
        }),
    )
    const stuck = store.flushOfflineQueue()
    store.abortStuckFlush()
    await stuck

    // No se descartó nada: sigue en la cola, no cuenta como rechazado.
    expect(store.offlineQueue).toHaveLength(1)
    expect(store.rejectedNotice).toBe(0)

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 8, changed_at: '2026-10-12T08:00:00Z', type: 'mojado' } },
    })
    const { sent } = await store.flushOfflineQueue()
    expect(sent).toBe(1)
    expect(store.offlineQueue).toEqual([])
  })

  it('still throws a validation error instead of queueing', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    store.offlineQueue = []

    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 422 },
    })
    await expect(
      store.createSleep({ started_at: '2026-10-12T08:00:00Z', ended_at: null }),
    ).rejects.toBeTruthy()
    expect(store.offlineQueue).toEqual([])
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

    expect(apiClient.delete).toHaveBeenCalledWith('/babies/1/feeds/5', {
      timeout: 20000,
      signal: expect.any(AbortSignal),
    })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('queues a feed as pending when the API does not answer in time (cold start)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    const store = useBabiesStore()
    await store.create({})
    // Lo que axios lanza al agotarse el tiempo: error sin respuesta.
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      Object.assign(new Error('timeout of 7000ms exceeded'), {
        isAxiosError: true,
        code: 'ECONNABORTED',
      }),
    )

    const result = await store.createFeed({ type: 'pecho', started_at: '2026-08-30T10:00' })

    expect(result).toBe('queued')
    expect(store.offlineQueue).toHaveLength(1)
    expect(store.timeline[0]?.pending).toBe(store.offlineQueue[0]?.clientUuid)
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
    expect(apiClient.get).toHaveBeenCalledWith('/babies/1/sleep-prediction', {
      params: { tz: expect.any(String) },
    })
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

  // --- Registro LOCAL PRIMERO: la pantalla responde al instante aunque la red esté
  // colgada (wifi sin internet, datos sin cobertura, la API de Render despertando).
  // Antes se esperaba hasta 7 s a la red, con el botón activo y sin aviso. ---
  describe('local-first saving', () => {
    function deferred<T = unknown>() {
      let resolve!: (value: T) => void
      let reject!: (error: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    async function storeWithBaby() {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
      const store = useBabiesStore()
      await store.create({})
      store.offlineQueue = []
      store.offlineUpdates = []
      return store
    }

    it('shows a new log at once and answers "queued" after the grace when the network hangs', async () => {
      const store = await storeWithBaby()
      vi.useFakeTimers()
      try {
        const hung = deferred()
        vi.mocked(apiClient.post).mockReturnValueOnce(hung.promise as never)

        const result = store.createFeed({ type: 'pecho', started_at: '2026-10-12T08:00:00Z' })

        // Antes de que el servidor diga nada, ya está guardado y visible como pendiente.
        expect(store.offlineQueue).toHaveLength(1)
        expect(store.timeline[0]).toMatchObject({ type: 'feed', pending: expect.any(String) })

        await vi.advanceTimersByTimeAsync(1_499)
        let settled = false
        void result.then(() => (settled = true))
        await vi.advanceTimersByTimeAsync(0)
        expect(settled).toBe(false)

        await vi.advanceTimersByTimeAsync(2)
        expect(await result).toBe('queued')
        // Respondió en ~1,5 s, no en los 7+ s de antes.
        expect(store.offlineQueue).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps sending in the background and swaps the pending entry for the real one', async () => {
      const store = await storeWithBaby()
      vi.useFakeTimers()
      try {
        const slow = deferred<{ data: { data: unknown } }>()
        vi.mocked(apiClient.post).mockReturnValueOnce(slow.promise as never)

        const result = store.createFeed({ type: 'pecho', started_at: '2026-10-12T08:00:00Z' })
        await vi.advanceTimersByTimeAsync(1_600)
        expect(await result).toBe('queued')

        slow.resolve({ data: { data: { id: 31, started_at: '2026-10-12T08:00:00Z' } } })
        await vi.advanceTimersByTimeAsync(0)

        expect(store.offlineQueue).toEqual([])
        expect(store.timeline).toEqual([
          {
            type: 'feed',
            at: '2026-10-12T08:00:00Z',
            data: { id: 31, started_at: '2026-10-12T08:00:00Z' },
          },
        ])
      } finally {
        vi.useRealTimers()
      }
    })

    it('answers "saved" when the server confirms inside the grace', async () => {
      const store = await storeWithBaby()
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { data: { id: 5, started_at: '2026-10-12T08:00:00Z' } },
      })

      expect(await store.createFeed({ type: 'pecho', started_at: '2026-10-12T08:00:00Z' })).toBe(
        'saved',
      )
      expect(store.offlineQueue).toEqual([])
    })

    it("still gives the form the server's validation error when it answers inside the grace", async () => {
      const store = await storeWithBaby()
      const rejection = { isAxiosError: true, response: { status: 422 } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(rejection)

      await expect(
        store.createSleep({ started_at: '2026-10-12T08:00:00Z', ended_at: '2026-10-12T07:00:00Z' }),
      ).rejects.toBe(rejection)

      expect(store.offlineQueue).toEqual([])
      expect(store.timeline).toEqual([])
      expect(store.rejectedNotice).toBe(0) // ya llegó al formulario: no se avisa dos veces
    })

    it('notices a rejection that arrives after the grace, when nobody is waiting any more', async () => {
      const store = await storeWithBaby()
      vi.useFakeTimers()
      try {
        const slow = deferred()
        vi.mocked(apiClient.post).mockReturnValueOnce(slow.promise as never)

        const result = store.createFeed({ type: 'pecho', started_at: '2026-10-12T08:00:00Z' })
        await vi.advanceTimersByTimeAsync(1_600)
        expect(await result).toBe('queued')

        slow.reject({ isAxiosError: true, response: { status: 422 } })
        await vi.advanceTimersByTimeAsync(0)

        expect(store.offlineQueue).toEqual([])
        expect(store.timeline).toEqual([])
        expect(store.rejectedNotice).toBe(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('finishing a sleep shows it finished at once and queues it while the network hangs', async () => {
      const store = await storeWithBaby()
      const ongoing = { id: 9, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
      store.timeline = [{ type: 'sleep', at: ongoing.started_at, data: ongoing as never }]
      vi.useFakeTimers()
      try {
        const hung = deferred()
        vi.mocked(apiClient.put).mockReturnValueOnce(hung.promise as never)
        const payload = { started_at: ongoing.started_at, ended_at: '2026-10-12T09:00:00Z' }

        const result = store.updateSleep(9, payload)

        // Sin esperar a nada: la entrada ya consta como acabada (adiós al botón Finalizar).
        expect((store.timeline[0]!.data as { ended_at: string }).ended_at).toBe(payload.ended_at)
        expect(store.offlineUpdates).toHaveLength(1)

        await vi.advanceTimersByTimeAsync(1_600)
        expect(await result).toBe('queued')

        hung.resolve({ data: { data: { ...ongoing, ...payload } } })
        await vi.advanceTimersByTimeAsync(0)
        expect(store.offlineUpdates).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('rolls the screen back if the server refuses the finish', async () => {
      const store = await storeWithBaby()
      const ongoing = { id: 9, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
      store.timeline = [{ type: 'sleep', at: ongoing.started_at, data: ongoing as never }]
      const rejection = { isAxiosError: true, response: { status: 422 } }
      vi.mocked(apiClient.put).mockRejectedValueOnce(rejection)
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: [{ type: 'sleep', at: ongoing.started_at, data: ongoing }] },
      })

      await expect(
        store.updateSleep(9, { started_at: ongoing.started_at, ended_at: '2026-10-12T07:00:00Z' }),
      ).rejects.toBe(rejection)

      expect(store.offlineUpdates).toEqual([])
      // Se vuelve a pedir la línea temporal real: la entrada vuelve a estar en curso.
      expect(apiClient.get).toHaveBeenCalled()
    })

    it('does not lose a "Finalizar" made while the create is still being sent', async () => {
      const store = await storeWithBaby()
      vi.useFakeTimers()
      try {
        const slow = deferred<{ data: { data: unknown } }>()
        vi.mocked(apiClient.post).mockReturnValueOnce(slow.promise as never)

        const result = store.createSleep({ started_at: '2026-10-12T08:00:00Z', ended_at: null })
        await vi.advanceTimersByTimeAsync(1_600)
        expect(await result).toBe('queued')

        // El sueño sigue en la cola (el POST sin contestar) y se pulsa Finalizar.
        const tempId = store.offlineQueue[0]!.tempId
        store.updateQueued(tempId, { ended_at: '2026-10-12T09:00:00Z' })

        // El servidor recibió el alta SIN ese cambio...
        vi.mocked(apiClient.put).mockResolvedValueOnce({
          data: {
            data: { id: 77, started_at: '2026-10-12T08:00:00Z', ended_at: '2026-10-12T09:00:00Z' },
          },
        })
        slow.resolve({
          data: { data: { id: 77, started_at: '2026-10-12T08:00:00Z', ended_at: null } },
        })
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(0)

        // ...y el cambio se envía después como PUT sobre el registro ya creado.
        expect(apiClient.put).toHaveBeenCalledWith(
          '/babies/1/sleeps/77',
          { started_at: '2026-10-12T08:00:00Z', ended_at: '2026-10-12T09:00:00Z' },
          { timeout: 20000, signal: expect.any(AbortSignal) },
        )
        expect(store.offlineQueue).toEqual([])
        expect(store.offlineUpdates).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps a newer change to the same record that was made while an older one was sending', async () => {
      const store = await storeWithBaby()
      const ongoing = { id: 9, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
      store.timeline = [{ type: 'sleep', at: ongoing.started_at, data: ongoing as never }]
      vi.useFakeTimers()
      try {
        const first = deferred<{ data: { data: unknown } }>()
        vi.mocked(apiClient.put).mockReturnValueOnce(first.promise as never)
        const older = { started_at: ongoing.started_at, ended_at: '2026-10-12T09:00:00Z' }
        const newer = { started_at: ongoing.started_at, ended_at: '2026-10-12T09:30:00Z' }

        const a = store.updateSleep(9, older)
        await vi.advanceTimersByTimeAsync(0)
        // Mientras el primero sigue enviándose, se cambia otra vez.
        vi.advanceTimersByTime(1)
        await new Promise<void>((resolve) => resolve())
        vi.setSystemTime(Date.now() + 5)
        vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { data: { ...ongoing, ...newer } } })
        const b = store.updateSleep(9, newer)

        first.resolve({ data: { data: { ...ongoing, ...older } } })
        await vi.advanceTimersByTimeAsync(1_600)
        await Promise.all([a, b])

        const sent = vi
          .mocked(apiClient.put)
          .mock.calls.map((call) => (call[1] as { ended_at: string }).ended_at)
        expect(sent).toEqual([older.ended_at, newer.ended_at])
        expect(store.offlineUpdates).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('deleting is local first too: gone from the screen at once, sent in the background', async () => {
      const store = await storeWithBaby()
      const row = { id: 5, baby_id: 1, started_at: '2026-10-12T08:00:00Z', ended_at: null }
      store.timeline = [{ type: 'feed', at: row.started_at, data: row as never }]
      vi.useFakeTimers()
      try {
        const hung = deferred()
        vi.mocked(apiClient.delete).mockReturnValueOnce(hung.promise as never)

        const result = store.deleteFeed(5)
        expect(store.timeline).toEqual([])
        expect(store.offlineUpdates).toMatchObject([
          { type: 'feed', targetId: 5, action: 'delete' },
        ])

        await vi.advanceTimersByTimeAsync(1_600)
        await result

        hung.resolve({})
        await vi.advanceTimersByTimeAsync(0)
        expect(store.offlineUpdates).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('uses a single sending cycle: a second flush while one runs does nothing extra', async () => {
      const store = await storeWithBaby()
      vi.useFakeTimers()
      try {
        const hung = deferred()
        vi.mocked(apiClient.post).mockReturnValueOnce(hung.promise as never)
        void store.createTemperature({ measured_at: '2026-10-12T08:00:00Z', celsius: 37.2 })
        await vi.advanceTimersByTimeAsync(0)

        expect(await store.flushOfflineQueue()).toEqual({ sent: 0, rejected: 0 })
        expect(vi.mocked(apiClient.post)).toHaveBeenCalledTimes(2) // el bebé + un solo envío

        hung.resolve({
          data: { data: { id: 1, measured_at: '2026-10-12T08:00:00Z', celsius: 37.2 } },
        })
        await vi.advanceTimersByTimeAsync(1_600)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
