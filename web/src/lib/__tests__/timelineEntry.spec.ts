import { describe, it, expect, vi } from 'vitest'
import {
  entryCategory,
  entryDiaperSizeLabel,
  entryDuration,
  entryEndTime,
  entryMilkDroplet,
  entryPeeDroplet,
  entryPoopColor,
  entrySleepEmoji,
  entrySleepPulsing,
  entryTitle,
  filterTimelineToDay,
  formatDuration,
  formatTime,
  groupTimelineByDay,
} from '@/lib/timelineEntry'
import { DIAPER_PEE_COLOR, DIAPER_RESIDUE_COLOR_HEX } from '@/lib/diaperResidueColor'
import { MILK_TYPE_DROPLET_FILL } from '@/lib/milkType'
import type { DiaperChange, Feed, Sleep, TimelineEntry } from '@/stores/babies'

// Construido a partir de componentes de Date locales, no una cadena
// "...Z" fija - mismo motivo que stats.spec.ts: filterTimelineToDay
// compara contra límites de día LOCALES (parseDateOnly + setHours), así
// que una cadena de desfase UTC fijo se comportaría distinto en CI
// (UTC) que en una máquina local (Europe/Madrid).
function local(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

function feed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    type: 'pecho',
    side: null,
    milk_type: null,
    amount_ml: null,
    started_at: '2026-08-07T10:00:00.000Z',
    ended_at: null,
    notes: null,
    ...overrides,
  }
}

function sleep(overrides: Partial<Sleep> = {}): Sleep {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    started_at: '2026-08-07T10:00:00.000Z',
    ended_at: null,
    notes: null,
    ...overrides,
  }
}

function diaperChange(overrides: Partial<DiaperChange> = {}): DiaperChange {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    changed_at: '2026-08-07T10:00:00.000Z',
    type: 'mojado',
    residue_color: null,
    size: null,
    notes: null,
    ...overrides,
  }
}

function feedEntry(overrides: Partial<Feed> = {}): TimelineEntry {
  const data = feed(overrides)
  return { type: 'feed', at: data.started_at, data }
}

function sleepEntry(overrides: Partial<Sleep> = {}): TimelineEntry {
  const data = sleep(overrides)
  return { type: 'sleep', at: data.started_at, data }
}

function diaperEntry(overrides: Partial<DiaperChange> = {}): TimelineEntry {
  const data = diaperChange(overrides)
  return { type: 'diaper_change', at: data.changed_at, data }
}

describe('entryCategory', () => {
  it('maps diaper_change to the diaper category', () => {
    expect(entryCategory(diaperEntry())).toBe('diaper')
  })

  it('passes feed/sleep through unchanged', () => {
    expect(entryCategory(feedEntry())).toBe('feed')
    expect(entryCategory(sleepEntry())).toBe('sleep')
  })
})

describe('entryPeeDroplet', () => {
  it('shows the pee color for a wet or both diaper change', () => {
    expect(entryPeeDroplet(diaperEntry({ type: 'mojado' }))).toBe(DIAPER_PEE_COLOR)
    expect(entryPeeDroplet(diaperEntry({ type: 'ambos' }))).toBe(DIAPER_PEE_COLOR)
  })

  it('renders nothing for a dirty-only diaper change or a non-diaper entry', () => {
    expect(entryPeeDroplet(diaperEntry({ type: 'sucio' }))).toBeUndefined()
    expect(entryPeeDroplet(feedEntry())).toBeUndefined()
  })
})

describe('entryPoopColor', () => {
  it('falls back to brown when no residue color was noted', () => {
    expect(entryPoopColor(diaperEntry({ type: 'sucio', residue_color: null }))).toBe(
      DIAPER_RESIDUE_COLOR_HEX.marron,
    )
  })

  it('uses the noted residue color when present', () => {
    expect(entryPoopColor(diaperEntry({ type: 'ambos', residue_color: 'verde' }))).toBe(
      DIAPER_RESIDUE_COLOR_HEX.verde,
    )
  })

  it('renders nothing for a wet-only diaper change', () => {
    expect(entryPoopColor(diaperEntry({ type: 'mojado' }))).toBeUndefined()
  })
})

describe('entrySleepEmoji / entrySleepPulsing', () => {
  it('shows the sleep emoji only for sleep entries', () => {
    expect(entrySleepEmoji(sleepEntry())).toBe('💤')
    expect(entrySleepEmoji(feedEntry())).toBeUndefined()
  })

  it('pulses only while a sleep is still ongoing (no ended_at)', () => {
    expect(entrySleepPulsing(sleepEntry({ ended_at: null }))).toBe(true)
    expect(entrySleepPulsing(sleepEntry({ ended_at: '2026-08-07T11:00:00.000Z' }))).toBe(false)
    expect(entrySleepPulsing(feedEntry())).toBe(false)
  })
})

describe('formatDuration', () => {
  it('formats minutes under an hour as just minutes', () => {
    expect(formatDuration('2026-08-07T10:00:00.000Z', '2026-08-07T10:25:00.000Z')).toBe('25min')
  })

  it('formats an hour or more as hours and minutes', () => {
    expect(formatDuration('2026-08-07T10:00:00.000Z', '2026-08-07T11:30:00.000Z')).toBe('1h 30min')
  })

  it('uses the injected clock when still ongoing (no endedAt)', () => {
    const now = () => new Date('2026-08-07T10:45:00.000Z').getTime()
    expect(formatDuration('2026-08-07T10:00:00.000Z', null, now)).toBe('45min')
  })

  it('never goes negative, even against a clock skew', () => {
    const now = () => new Date('2026-08-07T09:00:00.000Z').getTime()
    expect(formatDuration('2026-08-07T10:00:00.000Z', null, now)).toBe('0min')
  })
})

describe('entryEndTime / entryDuration', () => {
  it('reports neither end time nor duration for an ongoing sleep', () => {
    const entry = sleepEntry({ ended_at: null })
    expect(entryEndTime(entry)).toBeUndefined()
    expect(entryDuration(entry)).toBeUndefined()
  })

  it('reports both once a sleep has ended', () => {
    const entry = sleepEntry({
      started_at: '2026-08-07T10:00:00.000Z',
      ended_at: '2026-08-07T11:15:00.000Z',
    })
    expect(entryEndTime(entry)).toBe(formatTime('2026-08-07T11:15:00.000Z'))
    expect(entryDuration(entry)).toBe('1h 15min')
  })

  it('reports both for a finished breastfeed, neither for a bottle/solid feed', () => {
    const breastfeed = feedEntry({
      type: 'pecho',
      started_at: '2026-08-07T10:00:00.000Z',
      ended_at: '2026-08-07T10:15:00.000Z',
    })
    expect(entryEndTime(breastfeed)).toBe(formatTime('2026-08-07T10:15:00.000Z'))
    expect(entryDuration(breastfeed)).toBe('15min')

    const bottle = feedEntry({ type: 'biberon', ended_at: '2026-08-07T10:15:00.000Z' })
    expect(entryEndTime(bottle)).toBeUndefined()
    expect(entryDuration(bottle)).toBeUndefined()
  })

  it('reports neither for a diaper change', () => {
    const entry = diaperEntry()
    expect(entryEndTime(entry)).toBeUndefined()
    expect(entryDuration(entry)).toBeUndefined()
  })
})

describe('entryDiaperSizeLabel', () => {
  it('asks the translator for a size badge when a size was noted', () => {
    const t = vi.fn((key: string, params?: Record<string, unknown>) => `${key}:${params?.size}`)
    expect(entryDiaperSizeLabel(diaperEntry({ size: '2' }), t)).toBe(
      'dashboard.diaperForm.sizeBadge:2',
    )
    expect(t).toHaveBeenCalledWith('dashboard.diaperForm.sizeBadge', { size: '2' })
  })

  it('renders nothing without a noted size, or for a non-diaper entry', () => {
    const t = vi.fn()
    expect(entryDiaperSizeLabel(diaperEntry({ size: null }), t)).toBeUndefined()
    expect(entryDiaperSizeLabel(feedEntry(), t)).toBeUndefined()
    expect(t).not.toHaveBeenCalled()
  })
})

describe('entryMilkDroplet', () => {
  it('colors a bottle feed as leche regardless of milk_type', () => {
    expect(entryMilkDroplet(feedEntry({ type: 'biberon' }))).toBe(MILK_TYPE_DROPLET_FILL.leche)
  })

  it('colors a breastfeed by its own milk_type, falling back to leche', () => {
    expect(entryMilkDroplet(feedEntry({ type: 'pecho', milk_type: 'calostro' }))).toBe(
      MILK_TYPE_DROPLET_FILL.calostro,
    )
    expect(entryMilkDroplet(feedEntry({ type: 'pecho', milk_type: null }))).toBe(
      MILK_TYPE_DROPLET_FILL.leche,
    )
  })

  it('renders nothing for a solid feed or a non-feed entry', () => {
    expect(entryMilkDroplet(feedEntry({ type: 'solido' }))).toBeUndefined()
    expect(entryMilkDroplet(sleepEntry())).toBeUndefined()
  })
})

describe('entryTitle', () => {
  const t = vi.fn((key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  )

  it('summarizes a bottle feed with its amount', () => {
    expect(entryTitle(feedEntry({ type: 'biberon', amount_ml: 120 }), t, vi.fn(), vi.fn())).toBe(
      'dashboard.timeline.bottleSummary:{"amount":120}',
    )
  })

  it('summarizes a breastfeed with the resolved side label', () => {
    const sideLabel = vi.fn(() => 'Izquierdo')
    expect(entryTitle(feedEntry({ type: 'pecho', side: 'izquierdo' }), t, sideLabel, vi.fn())).toBe(
      'dashboard.timeline.breastSummary:{"side":"Izquierdo"}',
    )
    expect(sideLabel).toHaveBeenCalledWith('izquierdo')
  })

  it('summarizes a solid feed with no params', () => {
    expect(entryTitle(feedEntry({ type: 'solido' }), t, vi.fn(), vi.fn())).toBe(
      'dashboard.timeline.solidSummary',
    )
  })

  it('distinguishes a finished sleep from an ongoing one', () => {
    expect(
      entryTitle(sleepEntry({ ended_at: '2026-08-07T11:00:00.000Z' }), t, vi.fn(), vi.fn()),
    ).toBe('dashboard.timeline.sleepDone')
    expect(entryTitle(sleepEntry({ ended_at: null }), t, vi.fn(), vi.fn())).toBe(
      'dashboard.timeline.sleepOngoing',
    )
  })

  it('summarizes a diaper change with the resolved type label', () => {
    const diaperTypeLabel = vi.fn(() => 'Mojado')
    expect(entryTitle(diaperEntry({ type: 'mojado' }), t, vi.fn(), diaperTypeLabel)).toBe(
      'dashboard.timeline.diaperSummary:{"type":"Mojado"}',
    )
    expect(diaperTypeLabel).toHaveBeenCalledWith('mojado')
  })
})

describe('filterTimelineToDay', () => {
  it('keeps only entries whose local time falls within the requested day', () => {
    const timeline = [
      feedEntry({ started_at: local(2026, 8, 6, 23, 30) }), // víspera
      sleepEntry({ started_at: local(2026, 8, 7, 0, 0) }), // justo al empezar el día
      diaperEntry({ changed_at: local(2026, 8, 7, 14, 0) }), // dentro del día
      feedEntry({ started_at: local(2026, 8, 7, 23, 59) }), // justo antes de acabar
      sleepEntry({ started_at: local(2026, 8, 8, 0, 1) }), // día siguiente
    ]

    const result = filterTimelineToDay(timeline, '2026-08-07')

    expect(result).toHaveLength(3)
    expect(result.map((e) => e.at)).toEqual([
      local(2026, 8, 7, 0, 0),
      local(2026, 8, 7, 14, 0),
      local(2026, 8, 7, 23, 59),
    ])
  })

  it('returns an empty list when nothing falls on that day', () => {
    const timeline = [feedEntry({ started_at: local(2026, 8, 6, 12, 0) })]
    expect(filterTimelineToDay(timeline, '2026-08-07')).toEqual([])
  })
})

describe('groupTimelineByDay', () => {
  it('inserts one separator per calendar day, right before its first entry', () => {
    const day1feed = feedEntry({ started_at: local(2026, 8, 6, 9, 0) })
    const day1sleep = sleepEntry({ started_at: local(2026, 8, 6, 20, 0) })
    const day2diaper = diaperEntry({ changed_at: local(2026, 8, 7, 8, 0) })

    const items = groupTimelineByDay(
      [day1feed, day1sleep, day2diaper],
      (at) => `label-${at.getDate()}`,
    )

    expect(items.map((i) => i.kind)).toEqual(['separator', 'entry', 'entry', 'separator', 'entry'])
    expect(items[0]).toMatchObject({ kind: 'separator', label: 'label-6' })
    expect(items[3]).toMatchObject({ kind: 'separator', label: 'label-7' })
  })

  it('returns an empty list for an empty timeline, no stray separator', () => {
    expect(groupTimelineByDay([], () => 'unused')).toEqual([])
  })

  it('keys entries by type+id so same-id entries of different types never collide', () => {
    const feedOne = feedEntry({ started_at: local(2026, 8, 7, 9, 0) })
    const sleepOne = sleepEntry({ started_at: local(2026, 8, 7, 10, 0) })
    // Mismo id (1 en ambos fixtures), tipos distintos.
    const items = groupTimelineByDay([feedOne, sleepOne], () => 'día')
    const entryKeys = items.filter((i) => i.kind === 'entry').map((i) => i.key)
    expect(entryKeys).toEqual(['feed-1', 'sleep-1'])
  })
})
