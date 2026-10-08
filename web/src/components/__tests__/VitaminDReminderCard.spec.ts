import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VitaminDReminderCard from '@/components/VitaminDReminderCard.vue'
import { useBabiesStore } from '@/stores/babies'
import { addDays, todayDateOnlyString } from '@/lib/localDate'
import { i18n } from '@/i18n'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const today = todayDateOnlyString()

function mountCard() {
  return mount(VitaminDReminderCard, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
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

describe('VitaminDReminderCard', () => {
  it('renders nothing when hidden (no schedule)', () => {
    const wrapper = mountCard()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('shows the pending alert within range with no dose logged for today', () => {
    const babies = useBabiesStore()
    // start_date is today - no "yesterday" under the pauta yet, so the
    // plain pending message shows instead of the missedYesterday one.
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: today,
      end_date: addDays(today, 365),
    }

    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Toca darle hoy la dosis de vitamina D.')
  })

  it('mentions yesterday when it was also missed', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }

    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Ayer tampoco se marcó')
  })

  it('shows the confirmed state, not the alert, once today is given', () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    babies.vitaminDRecentDoses = [{ id: 1, baby_id: 1, date: today, given: true }]

    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Vitamina D de hoy, dada.')
    expect(wrapper.text()).not.toContain('Toca darle hoy')
  })

  it('clicking "Dada" calls the store action for today', async () => {
    const babies = useBabiesStore()
    babies.vitaminDSchedule = {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: addDays(today, -10),
      end_date: addDays(today, 355),
    }
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { data: { id: 1, baby_id: 1, date: today, given: true } },
    })

    const wrapper = mountCard()
    const givenButton = wrapper.findAll('button').find((b) => b.text() === 'Dada')
    await givenButton?.trigger('click')
    await wrapper.vm.$nextTick()

    expect(apiClient.put).toHaveBeenCalledWith('/babies/1/vitamin-d-doses', {
      date: today,
      given: true,
    })
  })
})
