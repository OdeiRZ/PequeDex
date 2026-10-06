import { describe, it, expect } from 'vitest'
import {
  summarizeSleepStats,
  summarizeFeedStats,
  summarizeDiaperStats,
  summarizeGrowthStats,
} from '@/lib/stats'
import type { DiaperChange, Feed, GrowthMeasurement, Sleep } from '@/stores/babies'

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

  it('averages the gap between one sleep ending and the next starting', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 11)), // ends 11:00
      sleep(local(2026, 8, 7, 14), local(2026, 8, 7, 14, 30)), // starts 14:00 -> gap 180min; ends 14:30
      sleep(local(2026, 8, 7, 20), local(2026, 8, 7, 20, 45)), // starts 20:00 -> gap 330min
    ])
    expect(result.averageWakeWindowMinutes).toBe(255)
  })

  it('excludes a gap long enough to look like an overnight stretch', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 11)), // ends 11:00
      sleep(local(2026, 8, 7, 12), local(2026, 8, 7, 12, 30)), // starts 12:00 -> gap 60min
      sleep(local(2026, 8, 8, 8), local(2026, 8, 8, 8, 30)), // starts next day -> gap > 6h, excluded
    ])
    expect(result.averageWakeWindowMinutes).toBe(60)
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

  it('averages the gap between feeds across every type, not just pecho', () => {
    const result = summarizeFeedStats([
      feed({ type: 'pecho', started_at: local(2026, 8, 7, 8) }),
      feed({ type: 'biberon', started_at: local(2026, 8, 7, 11) }), // gap 180min
      feed({ type: 'solido', started_at: local(2026, 8, 7, 14) }), // gap 180min
    ])
    expect(result.averageGapMinutes).toBe(180)
  })

  it('excludes a feed gap long enough to look like an overnight stretch', () => {
    const result = summarizeFeedStats([
      feed({ started_at: local(2026, 8, 7, 8) }),
      feed({ started_at: local(2026, 8, 7, 10) }), // gap 120min
      feed({ started_at: local(2026, 8, 8, 7) }), // gap > 8h, excluded
    ])
    expect(result.averageGapMinutes).toBe(120)
  })

  it('averages feeds per calendar day across the whole logged span', () => {
    const result = summarizeFeedStats([
      feed({ started_at: local(2026, 8, 7, 8) }),
      feed({ started_at: local(2026, 8, 7, 14) }),
      feed({ started_at: local(2026, 8, 8, 8) }),
      feed({ started_at: local(2026, 8, 8, 14) }),
    ])
    // 4 feeds across 2 calendar days (7th and 8th, inclusive).
    expect(result.averagePerDay).toBe(2)
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

  it('averages changes per calendar day across the whole logged span', () => {
    const result = summarizeDiaperStats([
      diaperChange({ changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ changed_at: local(2026, 8, 7, 14) }),
      diaperChange({ changed_at: local(2026, 8, 7, 20) }),
    ])
    // 3 changes, all on the same calendar day.
    expect(result.averagePerDay).toBe(3)
  })
})

function growthMeasurement(overrides: Partial<GrowthMeasurement> = {}): GrowthMeasurement {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    measured_at: local(2026, 8, 7, 10),
    weight_grams: null,
    height_cm: null,
    head_circumference_cm: null,
    notes: null,
    weight_percentile: null,
    height_percentile: null,
    head_circumference_percentile: null,
    ...overrides,
  }
}

describe('summarizeGrowthStats', () => {
  it('returns an empty metric with no "gained" trend when nothing was logged', () => {
    const result = summarizeGrowthStats([])
    expect(result.weightKg).toEqual({
      points: [],
      latestValue: null,
      latestPercentile: null,
      gained: null,
      count: 0,
    })
  })

  it('converts weight from grams to kg and reports a single reading with no gain yet', () => {
    const result = summarizeGrowthStats([
      growthMeasurement({ weight_grams: 3500, weight_percentile: 45 }),
    ])
    expect(result.weightKg.count).toBe(1)
    expect(result.weightKg.latestValue).toBe(3.5)
    expect(result.weightKg.latestPercentile).toBe(45)
    expect(result.weightKg.gained).toBeNull()
  })

  it('sorts by date and computes the gain between the first and latest reading', () => {
    const result = summarizeGrowthStats([
      growthMeasurement({
        measured_at: local(2026, 9, 7),
        weight_grams: 4200,
        weight_percentile: 50,
      }),
      growthMeasurement({
        measured_at: local(2026, 8, 7),
        weight_grams: 3500,
        weight_percentile: 45,
      }),
    ])
    expect(result.weightKg.points.map((p) => p.value)).toEqual([3.5, 4.2])
    expect(result.weightKg.latestValue).toBe(4.2)
    expect(result.weightKg.latestPercentile).toBe(50)
    expect(result.weightKg.gained).toBeCloseTo(0.7)
  })

  it('tracks weight/height/head independently, skipping a metric nobody logged', () => {
    const result = summarizeGrowthStats([
      growthMeasurement({ height_cm: 52 }),
      growthMeasurement({ height_cm: 56 }),
    ])
    expect(result.heightCm.count).toBe(2)
    expect(result.heightCm.gained).toBe(4)
    expect(result.weightKg.count).toBe(0)
    expect(result.headCircumferenceCm.count).toBe(0)
  })
})
