import { describe, it, expect, beforeEach } from 'vitest'
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
