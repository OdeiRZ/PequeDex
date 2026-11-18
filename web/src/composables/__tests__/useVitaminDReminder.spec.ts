import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
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
    region: null,
    vaccinations_enabled: false,
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

  it('flags dayBeforeAlsoMissing when pending and yesterday was not given, pauta already running then', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }

    const { dayBeforeAlsoMissing } = useVitaminDReminder()
    expect(dayBeforeAlsoMissing.value).toBe(true)
  })

  it('does not flag dayBeforeAlsoMissing when the pauta started today (no "yesterday" to have missed)', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: today,
      end_date: addDays(today, 365),
    }

    const { dayBeforeAlsoMissing } = useVitaminDReminder()
    expect(dayBeforeAlsoMissing.value).toBe(false)
  })

  it('does not flag dayBeforeAlsoMissing when yesterday was given', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: yesterday, given: true }]

    const { dayBeforeAlsoMissing } = useVitaminDReminder()
    expect(dayBeforeAlsoMissing.value).toBe(false)
  })

  it('markDay calls the store action with the right date', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { data: { id: 1, baby_id: 1, date: today, given: true } },
    })
    const { markDay } = useVitaminDReminder()

    await markDay(true)

    expect(apiClient.put).toHaveBeenCalledWith(
      '/babies/1/vitamin-d-doses',
      { date: today, given: true },
      { timeout: 20_000 },
    )
  })

  describe('on a day other than today (the one open in Ritmo)', () => {
    const schedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -60),
      end_date: addDays(today, 300),
    }

    it('reads the dose of that day, not the one of today', () => {
      const babies = useBabiesStore()
      babies.vitaminDSchedule = schedule
      babies.vitaminDRecentDoses = [
        { id: 1, baby_id: 1, date: today, given: true },
        { id: 2, baby_id: 1, date: addDays(today, -3), given: false },
      ]

      expect(useVitaminDReminder(today).cardState.value).toBe('confirmed')
      const hace3 = useVitaminDReminder(addDays(today, -3))
      expect(hace3.cardState.value).toBe('pending')
      expect(hace3.isToday.value).toBe(false)
    })

    it('follows the day as it changes', () => {
      const babies = useBabiesStore()
      babies.vitaminDSchedule = schedule
      babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: yesterday, given: true }]
      const day = ref(today)

      const { cardState } = useVitaminDReminder(day)
      expect(cardState.value).toBe('pending')

      day.value = yesterday
      expect(cardState.value).toBe('confirmed')
    })

    it('finds a dose older than the 14-day window in the full history', () => {
      const babies = useBabiesStore()
      babies.vitaminDSchedule = schedule
      babies.vitaminDAllDoses = [{ id: 9, baby_id: 1, date: addDays(today, -40), given: true }]

      expect(useVitaminDReminder(addDays(today, -40)).cardState.value).toBe('confirmed')
    })

    it('is hidden for a day before the pauta started', () => {
      const babies = useBabiesStore()
      babies.vitaminDSchedule = schedule

      expect(useVitaminDReminder(addDays(today, -61)).cardState.value).toBe('hidden')
    })

    it('marks that day, not today', async () => {
      const babies = useBabiesStore()
      babies.vitaminDSchedule = schedule
      const dia = addDays(today, -5)
      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: { data: { id: 3, baby_id: 1, date: dia, given: true } },
      })

      await useVitaminDReminder(dia).markDay(true)

      expect(apiClient.put).toHaveBeenCalledWith(
        '/babies/1/vitamin-d-doses',
        { date: dia, given: true },
        { timeout: 20_000 },
      )
    })
  })
})
