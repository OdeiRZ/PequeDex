import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBabiesStore } from '@/stores/babies'
import { useVitaminDReminder } from '@/composables/useVitaminDReminder'
import { addDays, todayDateOnlyString } from '@/lib/localDate'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const today = todayDateOnlyString()
const yesterday = addDays(today, -1)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(apiClient.put).mockReset()
  const babies = useBabiesStore()
  babies.current = {
    id: 1,
    name: 'Peque',
    due_date: null,
    birth_date: '2026-01-01',
    sex: null,
    invite_code: 'ABCD1234',
    water_broke_at: null,
  }
})

describe('useVitaminDReminder', () => {
  it('is hidden with no schedule at all', () => {
    const { cardState } = useVitaminDReminder()
    expect(cardState.value).toBe('hidden')
  })

  it('is hidden when the schedule is disabled', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: false,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }

    const { cardState } = useVitaminDReminder()
    expect(cardState.value).toBe('hidden')
  })

  it('is hidden before start_date or after end_date', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, 1),
      end_date: addDays(today, 365),
    }
    expect(useVitaminDReminder().cardState.value).toBe('hidden')

    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -400),
      end_date: addDays(today, -1),
    }
    expect(useVitaminDReminder().cardState.value).toBe('hidden')
  })

  it('is pending within range with no dose logged for today', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }

    const { cardState } = useVitaminDReminder()
    expect(cardState.value).toBe('pending')
  })

  it('is confirmed when today already has a given:true dose', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: today, given: true }]

    const { cardState } = useVitaminDReminder()
    expect(cardState.value).toBe('confirmed')
  })

  it('stays pending when today has an explicit given:false dose', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: today, given: false }]

    const { cardState } = useVitaminDReminder()
    expect(cardState.value).toBe('pending')
  })

  it('flags yesterdayAlsoMissing when pending and yesterday was not given, pauta already running then', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }

    const { yesterdayAlsoMissing } = useVitaminDReminder()
    expect(yesterdayAlsoMissing.value).toBe(true)
  })

  it('does not flag yesterdayAlsoMissing when the pauta started today (no "yesterday" to have missed)', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: today,
      end_date: addDays(today, 365),
    }

    const { yesterdayAlsoMissing } = useVitaminDReminder()
    expect(yesterdayAlsoMissing.value).toBe(false)
  })

  it('does not flag yesterdayAlsoMissing when yesterday was given', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: yesterday, given: true }]

    const { yesterdayAlsoMissing } = useVitaminDReminder()
    expect(yesterdayAlsoMissing.value).toBe(false)
  })

  it('markToday calls the store action with the right date', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { data: { id: 1, baby_id: 1, date: today, given: true } },
    })
    const { markToday } = useVitaminDReminder()

    await markToday(true)

    expect(apiClient.put).toHaveBeenCalledWith('/babies/1/vitamin-d-doses', {
      date: today,
      given: true,
    })
  })
})
