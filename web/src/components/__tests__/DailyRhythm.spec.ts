import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DailyRhythm from '@/components/DailyRhythm.vue'
import { i18n } from '@/i18n'
import type { TimelineEntry } from '@/stores/babies'

function feed(startedAt: string, endedAt: string | null): TimelineEntry {
  return {
    type: 'feed',
    at: startedAt,
    data: {
      id: 1,
      baby_id: 1,
      user_id: 1,
      type: endedAt ? 'pecho' : 'biberon',
      side: endedAt ? 'derecho' : null,
      milk_type: null,
      amount_ml: endedAt ? null : 90,
      started_at: startedAt,
      ended_at: endedAt,
      notes: null,
    },
  }
}

function mountRhythm(timeline: TimelineEntry[], isToday: boolean) {
  return mount(DailyRhythm, {
    props: {
      timeline,
      enabledCategories: ['feed', 'sleep', 'diaper'],
      day: '2026-10-20',
      isToday,
      isBirthDay: false,
      dateLocale: 'es-ES',
    },
    global: { plugins: [i18n] },
  })
}

describe('DailyRhythm', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'es'
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 6, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('draws a feed with a duration from its start to its end, like a sleep', () => {
    // 3:00 a 3:36 = 2,5 % del día; una toma sin duración sigue siendo una marca.
    const wrapper = mountRhythm(
      [feed('2026-10-20T03:00:00', '2026-10-20T03:36:00'), feed('2026-10-20T05:00:00', null)],
      true,
    )
    const marks = wrapper.findAll('button[aria-label^="Toma"]')
    expect(marks).toHaveLength(2)
    const interval = marks.find((m) => m.attributes('aria-label')?.includes('–'))
    expect(interval?.attributes('style')).toContain('width: 2.5%')
    expect(interval?.attributes('aria-label')).toBe('Toma 03:00–03:36')
  })

  it('marks "now" only on today', () => {
    const today = mountRhythm([feed('2026-10-20T05:00:00', null)], true)
    const now = today.find('[data-testid="rhythm-now"]')
    expect(now.exists()).toBe(true)
    expect(now.attributes('style')).toContain('left: 25%')

    const pastDay = mountRhythm([feed('2026-10-20T05:00:00', null)], false)
    expect(pastDay.find('[data-testid="rhythm-now"]').exists()).toBe(false)
  })
})
