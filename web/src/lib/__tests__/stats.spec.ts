import { describe, it, expect } from 'vitest'
import { summarizeSleepStats, summarizeFeedStats, summarizeDiaperStats } from '@/lib/stats'
import type { DiaperChange, Feed, Sleep } from '@/stores/babies'

// Built from local Date components, not a hardcoded "...Z" string - a
// fixed UTC offset would shift which hour bucket a timestamp lands in
// depending on the machine's own timezone (CI vs a dev machine), since
// `summarizeSleepStats`/etc bucket by the LOCAL hour
// (`Date#getHours()`). Round-tripping through a local `Date` and back
// keeps each test self-consistent regardless of where it runs.
function local(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

function sleep(startedAt: string, endedAt: string | null): Sleep {
  return { id: 1, baby_id: 1, user_id: 1, started_at: startedAt, ended_at: endedAt, notes: null }
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
    started_at: local(2026, 8, 7, 10),
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
    changed_at: local(2026, 8, 7, 10),
    type: 'mojado',
    residue_color: null,
    size: null,
    notes: null,
    ...overrides,
  }
}

describe('summarizeSleepStats', () => {
  it('reports not enough data below the minimum sample size', () => {
    const result = summarizeSleepStats([sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 11))])
    expect(result.hasEnoughData).toBe(false)
    expect(result.totalCompleted).toBe(1)
  })

  it('averages duration across completed sleeps only, ignoring an ongoing one', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 11)), // 60min
      sleep(local(2026, 8, 7, 14), local(2026, 8, 7, 14, 30)), // 30min
      sleep(local(2026, 8, 7, 20), local(2026, 8, 7, 20, 45)), // 45min
      sleep(local(2026, 8, 8, 2), null), // ongoing - excluded
    ])
    expect(result.hasEnoughData).toBe(true)
    expect(result.totalCompleted).toBe(3)
    expect(result.averageDurationMinutes).toBe(45)
  })

  it('buckets each sleep by the local hour it started', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 2), local(2026, 8, 7, 2, 30)), // dawn
      sleep(local(2026, 8, 7, 8), local(2026, 8, 7, 8, 15)), // morning
      sleep(local(2026, 8, 7, 14), local(2026, 8, 7, 14, 15)), // afternoon
    ])
    const dawn = result.byHourBucket.find((b) => b.key === 'dawn')
    const morning = result.byHourBucket.find((b) => b.key === 'morning')
    const afternoon = result.byHourBucket.find((b) => b.key === 'afternoon')
    const night = result.byHourBucket.find((b) => b.key === 'night')
    expect(dawn?.value).toBe(30)
    expect(morning?.value).toBe(15)
    expect(afternoon?.value).toBe(15)
    expect(night?.value).toBe(0)
  })
})

describe('summarizeFeedStats', () => {
  it('reports not enough data below the minimum sample size', () => {
    const result = summarizeFeedStats([feed(), feed()])
    expect(result.hasEnoughData).toBe(false)
  })

  it('counts by type, pecho side, and averages bottle amount / pecho duration', () => {
    const result = summarizeFeedStats([
      feed({
        type: 'pecho',
        side: 'izquierdo',
        started_at: local(2026, 8, 7, 10),
        ended_at: local(2026, 8, 7, 10, 10),
      }),
      feed({
        type: 'pecho',
        side: 'izquierdo',
        started_at: local(2026, 8, 7, 10),
        ended_at: local(2026, 8, 7, 10, 20),
      }),
      feed({ type: 'biberon', amount_ml: 90 }),
      feed({ type: 'biberon', amount_ml: 110 }),
      feed({ type: 'solido' }),
    ])
    expect(result.hasEnoughData).toBe(true)
    expect(result.byType).toEqual({ pecho: 2, biberon: 2, solido: 1 })
    expect(result.pechoSideCounts.izquierdo).toBe(2)
    expect(result.averageBottleAmountMl).toBe(100)
    expect(result.averagePechoDurationMinutes).toBe(15)
  })

  it('buckets each feed by the local hour it started', () => {
    const result = summarizeFeedStats([
      feed({ started_at: local(2026, 8, 7, 23) }), // night
      feed({ started_at: local(2026, 8, 7, 23, 30) }), // night
      feed({ started_at: local(2026, 8, 7, 7) }), // morning
    ])
    const night = result.byHourBucket.find((b) => b.key === 'night')
    const morning = result.byHourBucket.find((b) => b.key === 'morning')
    expect(night?.value).toBe(2)
    expect(morning?.value).toBe(1)
  })
})

describe('summarizeDiaperStats', () => {
  it('reports not enough data below the minimum sample size', () => {
    const result = summarizeDiaperStats([diaperChange(), diaperChange()])
    expect(result.hasEnoughData).toBe(false)
  })

  it('counts by type and by size, defaulting a missing size to unspecified', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', size: '1' }),
      diaperChange({ type: 'sucio', size: '1' }),
      diaperChange({ type: 'ambos', size: null }),
    ])
    expect(result.hasEnoughData).toBe(true)
    expect(result.byType).toEqual({ mojado: 1, sucio: 1, ambos: 1 })
    expect(result.bySize['1']).toBe(2)
    expect(result.bySize.unspecified).toBe(1)
  })

  it('splits pee/poop patterns by hour bucket, counting "ambos" in both', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', changed_at: local(2026, 8, 7, 8) }), // morning, pee only
      diaperChange({ type: 'sucio', changed_at: local(2026, 8, 7, 8) }), // morning, poop only
      diaperChange({ type: 'ambos', changed_at: local(2026, 8, 7, 20) }), // night, both
    ])
    const peeMorning = result.peeByHourBucket.find((b) => b.key === 'morning')
    const poopMorning = result.poopByHourBucket.find((b) => b.key === 'morning')
    const peeNight = result.peeByHourBucket.find((b) => b.key === 'night')
    const poopNight = result.poopByHourBucket.find((b) => b.key === 'night')
    expect(peeMorning?.value).toBe(1)
    expect(poopMorning?.value).toBe(1)
    expect(peeNight?.value).toBe(1)
    expect(poopNight?.value).toBe(1)
  })
})
