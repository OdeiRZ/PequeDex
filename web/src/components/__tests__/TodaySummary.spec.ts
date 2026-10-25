import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TodaySummary from '@/components/TodaySummary.vue'
import { i18n } from '@/i18n'
import type { TimelineEntry } from '@/stores/babies'

function feedEntry(id: number, startedAt: string): TimelineEntry {
  return {
    type: 'feed',
    at: startedAt,
    data: {
      id,
      baby_id: 1,
      user_id: 1,
      type: 'biberon',
      side: null,
      milk_type: null,
      amount_ml: 90,
      started_at: startedAt,
      ended_at: null,
      notes: null,
    },
  }
}

function diaperEntry(id: number, changedAt: string): TimelineEntry {
  return {
    type: 'diaper_change',
    at: changedAt,
    data: {
      id,
      baby_id: 1,
      user_id: 1,
      changed_at: changedAt,
      type: 'mojado',
      residue_color: null,
      size: null,
      notes: null,
    },
  }
}

function mountSummary(timeline: TimelineEntry[]) {
  return mount(TodaySummary, {
    props: { timeline, enabledCategories: ['feed', 'diaper'], day: '2026-08-30' },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('TodaySummary pluralization', () => {
  it('uses the singular label with exactly 1', () => {
    const wrapper = mountSummary([
      feedEntry(1, '2026-08-30T10:00:00'),
      diaperEntry(2, '2026-08-30T11:00:00'),
    ])

    expect(wrapper.text()).toContain('toma')
    expect(wrapper.text()).not.toContain('tomas')
    expect(wrapper.text()).toContain('pañal')
    expect(wrapper.text()).not.toContain('pañales')
  })

  it('uses the plural label with 0', () => {
    const wrapper = mountSummary([])

    expect(wrapper.text()).toContain('tomas')
    expect(wrapper.text()).toContain('pañales')
  })

  it('uses the plural label with more than 1', () => {
    const wrapper = mountSummary([
      feedEntry(1, '2026-08-30T10:00:00'),
      feedEntry(2, '2026-08-30T14:00:00'),
      diaperEntry(3, '2026-08-30T11:00:00'),
      diaperEntry(4, '2026-08-30T15:00:00'),
      diaperEntry(5, '2026-08-30T18:00:00'),
      diaperEntry(6, '2026-08-30T21:00:00'),
    ])

    expect(wrapper.text()).toContain('tomas')
    expect(wrapper.text()).toContain('pañales')
  })
})

describe('TodaySummary "time since"', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says how long ago the last feed and diaper were, only for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 5, 10))
    const timeline = [feedEntry(1, '2026-10-20T05:00:00'), diaperEntry(2, '2026-10-20T01:40:00')]

    const today = mount(TodaySummary, {
      props: { timeline, enabledCategories: ['feed', 'diaper'], day: '2026-10-20' },
      global: { plugins: [i18n] },
    })
    expect(today.text()).toContain('última hace 10 min')
    expect(today.text()).toContain('último hace 3 h 30 min')

    const pastDay = mount(TodaySummary, {
      props: { timeline, enabledCategories: ['feed', 'diaper'], day: '2026-10-19' },
      global: { plugins: [i18n] },
    })
    expect(pastDay.text()).not.toContain('hace')
  })
})
