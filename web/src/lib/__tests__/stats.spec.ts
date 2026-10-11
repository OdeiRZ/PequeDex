import { describe, it, expect } from 'vitest'
import {
  summarizeSleepStats,
  summarizeFeedStats,
  summarizeDiaperStats,
  summarizeGrowthStats,
  summarizeWeeklyTrend,
  summarizeWeekComparison,
  summarizeActivityHeatmap,
  summarizeVitaminDStats,
  buildStatsExportPayload,
  filterByPeriod,
  filterPreviousPeriod,
  findLastPoopAt,
  summarizePeriodDeltas,
  type WeeklyTrendPoint,
} from '@/lib/stats'
import type {
  DiaperChange,
  Feed,
  GrowthMeasurement,
  Sleep,
  VitaminDDose,
  VitaminDSchedule,
} from '@/stores/babies'

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
    expect(result.averageDurationMinutes).toBeNull()
  })

  it('averages duration across completed sleeps only, ignoring an ongoing one', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 11)), // 60min
      sleep(local(2026, 8, 7, 14), local(2026, 8, 7, 14, 30)), // 30min
      sleep(local(2026, 8, 7, 20), local(2026, 8, 7, 20, 45)), // 45min
      sleep(local(2026, 8, 8, 2), null), // ongoing - excluded
    ])
    expect(result.hasEnoughData).toBe(true)
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

describe('summarizeSleepStats - sleeps per day / longest stretch', () => {
  it('reports the longest stretch as null below 3 distinct days', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 13), local(2026, 8, 7, 13, 30)),
      sleep(local(2026, 8, 7, 20), local(2026, 8, 7, 22)),
      sleep(local(2026, 8, 7, 23), local(2026, 8, 8, 1)),
    ])
    expect(result.averageLongestStretchMinutes).toBeNull()
    expect(result.averageSleepsPerDay).toBe(3)
  })

  it('averages the longest sleep of each day, whatever time it happened', () => {
    const result = summarizeSleepStats([
      // Día 1: el tramo más largo es de día (3h), no de noche
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 13)),
      sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 0)),
      // Día 2: 4h
      sleep(local(2026, 8, 8, 21), local(2026, 8, 9, 1)),
      // Día 3: 2h
      sleep(local(2026, 8, 9, 14), local(2026, 8, 9, 16)),
    ])
    // (180 + 240 + 120) / 3
    expect(result.averageLongestStretchMinutes).toBe(180)
    // 4 sueños en 3 días
    expect(result.averageSleepsPerDay).toBeCloseTo(4 / 3)
  })
})

describe('summarizeSleepStats - day/night split', () => {
  it('reports null below 3 distinct days with a completed sleep', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 13), local(2026, 8, 7, 13, 30)),
      sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 6)),
    ])
    expect(result.averageNightSleepMinutes).toBeNull()
    expect(result.averageDaySleepMinutes).toBeNull()
    expect(result.averageTotalSleepMinutes).toBeNull()
  })

  it('splits sleep time by the 20:00-08:00 clock window, per day', () => {
    const result = summarizeSleepStats([
      // Día 1: 2 siestas de 30min (60 total) + 8h de noche (480min)
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 10, 30)),
      sleep(local(2026, 8, 7, 14), local(2026, 8, 7, 14, 30)),
      sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 6)),
      // Día 2: 1 siesta de 60min + 8h de noche
      sleep(local(2026, 8, 8, 14), local(2026, 8, 8, 15)),
      sleep(local(2026, 8, 8, 22), local(2026, 8, 9, 6)),
      // Día 3: sin siesta, solo 8h de noche
      sleep(local(2026, 8, 9, 22), local(2026, 8, 10, 6)),
    ])
    expect(result.averageNightSleepMinutes).toBe(480)
    // (60 + 60 + 0) / 3 = 40
    expect(result.averageDaySleepMinutes).toBe(40)
    expect(result.averageTotalSleepMinutes).toBe(520)
  })

  it('counts several night sleeps as night, not only the longest one', () => {
    const result = summarizeSleepStats([
      // Cada noche, dos tramos de 3h dentro de la franja nocturna
      sleep(local(2026, 8, 7, 21), local(2026, 8, 8, 0)),
      sleep(local(2026, 8, 8, 2), local(2026, 8, 8, 5)),
      sleep(local(2026, 8, 8, 21), local(2026, 8, 9, 0)),
      sleep(local(2026, 8, 9, 2), local(2026, 8, 9, 5)),
      sleep(local(2026, 8, 9, 21), local(2026, 8, 10, 0)),
    ])
    expect(result.averageDaySleepMinutes).toBe(0)
  })

  it('splits a sleep straddling 20:00 between day and night', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 19), local(2026, 8, 7, 21)), // 1h día + 1h noche
      sleep(local(2026, 8, 8, 19), local(2026, 8, 8, 21)),
      sleep(local(2026, 8, 9, 19), local(2026, 8, 9, 21)),
    ])
    expect(result.averageNightSleepMinutes).toBe(60)
    expect(result.averageDaySleepMinutes).toBe(60)
  })
})

describe('filterByPeriod', () => {
  const now = new Date(2026, 7, 10, 15)
  const items = [
    { at: local(2026, 8, 10, 1) }, // hoy
    { at: local(2026, 8, 4, 0) }, // primer día de "últimos 7 días"
    { at: local(2026, 8, 3, 23, 59) }, // fuera de 7 días
    { at: local(2026, 7, 1, 10) }, // fuera de 30 días
  ]

  it('keeps today and the 6 previous calendar days for 7d', () => {
    expect(filterByPeriod(items, (i) => i.at, '7d', now)).toHaveLength(2)
  })

  it('keeps 14 calendar days for the check-up summary window', () => {
    expect(filterByPeriod(items, (i) => i.at, '14d', now)).toHaveLength(3)
  })

  it('keeps 30 calendar days for 30d', () => {
    expect(filterByPeriod(items, (i) => i.at, '30d', now)).toHaveLength(3)
  })

  it('keeps everything for all', () => {
    expect(filterByPeriod(items, (i) => i.at, 'all', now)).toHaveLength(4)
  })
})

describe('filterPreviousPeriod', () => {
  const now = new Date(2026, 7, 10, 15)

  it('takes the 7 calendar days right before the current 7-day period', () => {
    const items = [
      { at: local(2026, 8, 4, 0) }, // dentro del periodo actual
      { at: local(2026, 8, 3, 23, 59) }, // último instante del anterior
      { at: local(2026, 7, 28, 0) }, // primer día del anterior
      { at: local(2026, 7, 27, 23) }, // fuera
    ]
    expect(filterPreviousPeriod(items, (i) => i.at, '7d', now)).toEqual([items[1], items[2]])
  })

  it('is empty for the whole history', () => {
    expect(filterPreviousPeriod([{ at: local(2026, 1, 1) }], (i) => i.at, 'all', now)).toEqual([])
  })
})

describe('summarizePeriodDeltas', () => {
  const sleeps = (hours: number) => [
    sleep(local(2026, 8, 7, 22), local(2026, 8, 7, 22 + hours)),
    sleep(local(2026, 8, 8, 21), local(2026, 8, 8, 21 + hours)),
    sleep(local(2026, 8, 9, 20), local(2026, 8, 9, 20 + hours)),
  ]
  const changes = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      diaperChange({ type: 'ambos', changed_at: local(2026, 8, 7, 1 + i) }),
    )

  it('subtracts the previous period from the current one', () => {
    const deltas = summarizePeriodDeltas(
      {
        sleep: summarizeSleepStats(sleeps(2)),
        feed: summarizeFeedStats([]),
        diaper: summarizeDiaperStats(changes(5)),
      },
      {
        sleep: summarizeSleepStats(sleeps(1)),
        feed: summarizeFeedStats([]),
        diaper: summarizeDiaperStats(changes(3)),
      },
    )
    expect(deltas.longestStretchMinutes).toBe(60)
    expect(deltas.peePerDay).toBe(2)
    expect(deltas.poopPerDay).toBe(2)
  })

  it('is null where either period lacks the figure', () => {
    const deltas = summarizePeriodDeltas(
      {
        sleep: summarizeSleepStats(sleeps(2)),
        feed: summarizeFeedStats([]),
        diaper: summarizeDiaperStats([]),
      },
      {
        sleep: summarizeSleepStats([]),
        feed: summarizeFeedStats([]),
        diaper: summarizeDiaperStats([]),
      },
    )
    expect(deltas).toEqual({
      longestStretchMinutes: null,
      totalSleepMinutes: null,
      feedsPerDay: null,
      peePerDay: null,
      poopPerDay: null,
    })
  })
})

describe('summarizeSleepStats - longestSleep', () => {
  it('is null with no completed sleeps', () => {
    expect(summarizeSleepStats([]).longestSleep).toBeNull()
  })

  it('finds the single longest completed sleep, even below the sample threshold', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 5)), // 7h - the longest
      sleep(local(2026, 8, 8, 13), local(2026, 8, 8, 13, 30)), // 30min
    ])
    expect(result.longestSleep).toEqual({ minutes: 420, date: local(2026, 8, 7, 22) })
  })

  it('ignores an ongoing sleep (no ended_at) when picking the record', () => {
    const result = summarizeSleepStats([
      sleep(local(2026, 8, 7, 10), local(2026, 8, 7, 10, 30)), // 30min, completed
      sleep(local(2026, 8, 8, 22), null), // ongoing - excluded
    ])
    expect(result.longestSleep).toEqual({ minutes: 30, date: local(2026, 8, 7, 10) })
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

describe('summarizeFeedStats - gapStdDevMinutes', () => {
  it('is null below the minimum sample size', () => {
    const result = summarizeFeedStats([feed(), feed()])
    expect(result.gapStdDevMinutes).toBeNull()
  })

  it('is 0 when every gap is identical (perfectly regular)', () => {
    const result = summarizeFeedStats([
      feed({ started_at: local(2026, 8, 7, 8) }),
      feed({ started_at: local(2026, 8, 7, 11) }), // gap 180min
      feed({ started_at: local(2026, 8, 7, 14) }), // gap 180min
    ])
    expect(result.gapStdDevMinutes).toBe(0)
  })

  it('is greater than 0 when gaps vary (irregular schedule)', () => {
    const result = summarizeFeedStats([
      feed({ started_at: local(2026, 8, 7, 8) }),
      feed({ started_at: local(2026, 8, 7, 9) }), // gap 60min
      feed({ started_at: local(2026, 8, 7, 13) }), // gap 240min
    ])
    expect(result.gapStdDevMinutes).toBeGreaterThan(0)
  })
})

describe('summarizeDiaperStats', () => {
  it('reports not enough data below the minimum sample size', () => {
    const result = summarizeDiaperStats([diaperChange(), diaperChange()])
    expect(result.hasEnoughData).toBe(false)
  })

  it('counts by size, defaulting a missing size to unspecified', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', size: '1' }),
      diaperChange({ type: 'sucio', size: '1' }),
      diaperChange({ type: 'ambos', size: null }),
    ])
    expect(result.hasEnoughData).toBe(true)
    expect(result.bySize['1']).toBe(2)
    expect(result.bySize.unspecified).toBe(1)
  })

  it('buckets every change by the hour it was changed, without splitting pee/poop', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ type: 'sucio', changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ type: 'ambos', changed_at: local(2026, 8, 7, 20) }),
    ])
    expect(result.byHourBucket.find((b) => b.key === 'morning')?.value).toBe(2)
    expect(result.byHourBucket.find((b) => b.key === 'night')?.value).toBe(1)
  })

  it('counts "ambos" both as a diaper with pee and as one with poop', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ type: 'ambos', changed_at: local(2026, 8, 7, 14) }),
      diaperChange({ type: 'sucio', changed_at: local(2026, 8, 7, 20) }),
    ])
    expect(result.averagePeePerDay).toBe(2)
    expect(result.averagePoopPerDay).toBe(2)
  })

  it('uses the same day span for pee/poop per day as for all changes', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado', changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ type: 'mojado', changed_at: local(2026, 8, 8, 8) }),
      diaperChange({ type: 'sucio', changed_at: local(2026, 8, 9, 8) }),
    ])
    // 3 días: 1 caca en 3 días, no "1 caca en 1 día"
    expect(result.averagePoopPerDay).toBeCloseTo(1 / 3)
    expect(result.averagePeePerDay).toBeCloseTo(2 / 3)
  })

  it('averages the time between changes, skipping overnight-length gaps', () => {
    const result = summarizeDiaperStats([
      diaperChange({ changed_at: local(2026, 8, 7, 8) }),
      diaperChange({ changed_at: local(2026, 8, 7, 11) }), // 180min
      diaperChange({ changed_at: local(2026, 8, 7, 13) }), // 120min
      diaperChange({ changed_at: local(2026, 8, 8, 8) }), // > 8h, excluded
    ])
    expect(result.averageGapMinutes).toBe(150)
  })

  it('tallies the stool colour of dirty diapers only', () => {
    const result = summarizeDiaperStats([
      diaperChange({ type: 'mojado' }),
      diaperChange({ type: 'sucio', residue_color: 'amarillo' }),
      diaperChange({ type: 'ambos', residue_color: 'amarillo' }),
      diaperChange({ type: 'sucio', residue_color: null }),
    ])
    expect(result.poopColors).toEqual({
      verde: 0,
      amarillo: 2,
      marron: 0,
      meconio: 0,
      unspecified: 1,
    })
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

describe('findLastPoopAt', () => {
  it('is null when no diaper had poop', () => {
    expect(findLastPoopAt([diaperChange({ type: 'mojado' })])).toBeNull()
  })

  it('returns the most recent "sucio" or "ambos" change', () => {
    const latest = local(2026, 8, 9, 7)
    expect(
      findLastPoopAt([
        diaperChange({ type: 'sucio', changed_at: local(2026, 8, 7, 8) }),
        diaperChange({ type: 'ambos', changed_at: latest }),
        diaperChange({ type: 'mojado', changed_at: local(2026, 8, 10, 8) }),
      ]),
    ).toBe(latest)
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
      weeklyRate: null,
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
    // 0.7kg en 31 días (7 ago -> 7 sep) * 7 = ritmo semanal.
    expect(result.weightKg.weeklyRate).toBeCloseTo((0.7 / 31) * 7, 5)
  })

  it('reports no weekly rate with only a single reading (nothing to divide)', () => {
    const result = summarizeGrowthStats([growthMeasurement({ weight_grams: 3500 })])
    expect(result.weightKg.weeklyRate).toBeNull()
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

// 2026-08-10 es lunes; 2026-08-07 (viernes) y 2026-08-09 (domingo) caen
// en la semana ISO anterior (lunes 2026-08-03).
describe('summarizeWeeklyTrend', () => {
  it('groups entries into ISO weeks (Monday start), one point per week', () => {
    const result = summarizeWeeklyTrend(
      [sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 6))], // viernes -> semana del 3
      [
        feed({ started_at: local(2026, 8, 9, 10) }), // domingo -> semana del 3
        feed({ started_at: local(2026, 8, 11, 10) }), // martes -> semana del 10
      ],
      [diaperChange({ changed_at: local(2026, 8, 11, 12) })], // martes -> semana del 10
    )

    expect(result.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-10'])
    expect(result[0]).toEqual({
      weekStart: '2026-08-03',
      sleepHours: 8,
      longestStretchMinutes: 480,
      feedCount: 1,
      diaperCount: 0,
    })
    expect(result[1]).toEqual({
      weekStart: '2026-08-10',
      sleepHours: null,
      longestStretchMinutes: null,
      feedCount: 1,
      diaperCount: 1,
    })
  })

  it('averages the longest sleep of each day within the week', () => {
    const result = summarizeWeeklyTrend(
      [
        // Lunes 10: tramos de 2h y 4h -> 4h
        sleep(local(2026, 8, 10, 13), local(2026, 8, 10, 15)),
        sleep(local(2026, 8, 10, 22), local(2026, 8, 11, 2)),
        // Martes 11: un solo tramo de 2h
        sleep(local(2026, 8, 11, 22), local(2026, 8, 12, 0)),
      ],
      [],
      [],
    )
    // (240 + 120) / 2
    expect(result[0]?.longestStretchMinutes).toBe(180)
  })

  it('returns an empty list with no data at all', () => {
    expect(summarizeWeeklyTrend([], [], [])).toEqual([])
  })

  it('ignores an ongoing sleep (no ended_at) when summing hours for the week', () => {
    const result = summarizeWeeklyTrend(
      [
        sleep(local(2026, 8, 7, 22), local(2026, 8, 8, 2)), // 4h, completed
        sleep(local(2026, 8, 7, 23), null), // ongoing, excluded
      ],
      [],
      [],
    )
    expect(result[0]?.sleepHours).toBe(4)
  })
})

// 2026-07-27, 2026-08-03 y 2026-08-10 son los tres lunes consecutivos
// usados también en `summarizeWeeklyTrend` arriba.
describe('summarizeWeekComparison', () => {
  function point(weekStart: string, overrides: Partial<WeeklyTrendPoint> = {}): WeeklyTrendPoint {
    return {
      weekStart,
      sleepHours: null,
      longestStretchMinutes: null,
      feedCount: 0,
      diaperCount: 0,
      ...overrides,
    }
  }

  it('returns null with fewer than two COMPLETE weeks, even with 2+ weeks of raw data', () => {
    // Solo 2026-07-27 está completa (su domingo, 08-02, ya pasó); la
    // semana del 08-03 todavía no ha terminado el 2026-08-05.
    const trend = [point('2026-07-27'), point('2026-08-03')]
    expect(summarizeWeekComparison(trend, new Date(local(2026, 8, 5, 12)))).toBeNull()
  })

  it('bug regression: never compares the in-progress current week against a complete one', () => {
    // Antes del fix, con "hoy" a mitad de la semana del 08-10 (solo 3
    // días de dato todavía), el código viejo comparaba esa semana
    // incompleta contra la del 08-03 (completa, 7 días) y siempre salía
    // en negativo aunque no hubiera bajado nada de verdad.
    const trend = [
      point('2026-07-27', { feedCount: 20, diaperCount: 15 }),
      point('2026-08-03', { feedCount: 25, diaperCount: 18 }),
      point('2026-08-10', { feedCount: 6, diaperCount: 4 }), // en curso, pocos días
    ]

    const result = summarizeWeekComparison(trend, new Date(local(2026, 8, 12, 9)))

    expect(result?.weekStart).toBe('2026-08-03')
    expect(result?.feedCount).toEqual({ current: 25, delta: 5 })
    expect(result?.diaperCount).toEqual({ current: 18, delta: 3 })
  })

  it('compares the two most recent complete weeks once both have fully passed', () => {
    const trend = [
      point('2026-07-27', { sleepHours: 50, feedCount: 20, diaperCount: 15 }),
      point('2026-08-03', { sleepHours: 54, feedCount: 18, diaperCount: 16 }),
    ]

    const result = summarizeWeekComparison(trend, new Date(local(2026, 8, 10, 0)))

    expect(result).toEqual({
      weekStart: '2026-08-03',
      sleepHours: { current: 54, delta: 4 },
      feedCount: { current: 18, delta: -2 },
      diaperCount: { current: 16, delta: 1 },
    })
  })

  it('returns null sleepHours when either complete week has no sleep data', () => {
    const trend = [
      point('2026-07-27', { sleepHours: null, feedCount: 10, diaperCount: 10 }),
      point('2026-08-03', { sleepHours: 40, feedCount: 12, diaperCount: 11 }),
    ]

    const result = summarizeWeekComparison(trend, new Date(local(2026, 8, 10, 0)))

    expect(result?.sleepHours).toBeNull()
  })
})

describe('summarizeActivityHeatmap', () => {
  it('always returns a dense 7x24 grid (168 cells), zero where nothing happened', () => {
    const result = summarizeActivityHeatmap([], [], [])
    expect(result).toHaveLength(168)
    expect(result.every((cell) => cell.count === 0)).toBe(true)
  })

  it('buckets by LOCAL day-of-week (Monday=0) and hour, combining all three categories', () => {
    const result = summarizeActivityHeatmap(
      [sleep(local(2026, 8, 10, 22), local(2026, 8, 11, 6))], // lunes 22h
      [feed({ started_at: local(2026, 8, 10, 22, 30) })], // lunes 22h, misma celda
      [diaperChange({ changed_at: local(2026, 8, 7, 8) })], // viernes 8h
    )
    const mondayNight = result.find((c) => c.dayOfWeek === 0 && c.hour === 22)
    const fridayMorning = result.find((c) => c.dayOfWeek === 4 && c.hour === 8)
    expect(mondayNight?.count).toBe(2)
    expect(fridayMorning?.count).toBe(1)
    expect(result.filter((c) => c.count > 0)).toHaveLength(2)
  })
})

describe('summarizeVitaminDStats', () => {
  function schedule(overrides: Partial<VitaminDSchedule> = {}): VitaminDSchedule {
    return {
      id: 1,
      baby_id: 1,
      enabled: true,
      start_date: '2026-09-01',
      end_date: '2027-09-01',
      ...overrides,
    }
  }

  function dose(date: string, given = true): VitaminDDose {
    return { id: Math.random(), baby_id: 1, date, given }
  }

  it('returns hasSchedule:false with no schedule at all', () => {
    expect(summarizeVitaminDStats(null, [])).toEqual({ hasSchedule: false, given: 0, totalDays: 0 })
  })

  it('counts totalDays from start_date through today (inclusive) while the pauta is ongoing', () => {
    const now = new Date(local(2026, 9, 10, 12))
    const result = summarizeVitaminDStats(schedule({ start_date: '2026-09-01' }), [], now)

    // 1 sep .. 10 sep inclusive = 10 days.
    expect(result.totalDays).toBe(10)
  })

  it('counts only given:true doses within [start_date, today] as given', () => {
    const now = new Date(local(2026, 9, 10, 12))
    const doses = [
      dose('2026-09-02', true),
      dose('2026-09-03', false),
      dose('2026-08-20', true), // before start_date - out of range
      dose('2026-09-05', true),
    ]

    const result = summarizeVitaminDStats(schedule({ start_date: '2026-09-01' }), doses, now)

    expect(result.given).toBe(2)
  })

  it('caps totalDays at end_date once the pauta has already finished, not still growing with "today"', () => {
    const now = new Date(local(2026, 12, 1, 12))
    const result = summarizeVitaminDStats(
      schedule({ start_date: '2026-09-01', end_date: '2026-09-30' }),
      [],
      now,
    )

    // 1 sep .. 30 sep inclusive = 30 days, not clipped forward to December.
    expect(result.totalDays).toBe(30)
  })

  it('ignores doses given after end_date when the pauta already finished', () => {
    const now = new Date(local(2026, 12, 1, 12))
    const doses = [dose('2026-09-15', true), dose('2026-10-15', true)]

    const result = summarizeVitaminDStats(
      schedule({ start_date: '2026-09-01', end_date: '2026-09-30' }),
      doses,
      now,
    )

    expect(result.given).toBe(1)
  })
})

describe('buildStatsExportPayload - options', () => {
  const emptyBuckets = [
    { key: 'dawn' as const, value: 0 },
    { key: 'morning' as const, value: 0 },
    { key: 'afternoon' as const, value: 0 },
    { key: 'night' as const, value: 0 },
  ]
  const emptySleep = {
    hasEnoughData: false,
    averageDurationMinutes: null,
    averageWakeWindowMinutes: null,
    averageSleepsPerDay: null,
    averageLongestStretchMinutes: null,
    byHourBucket: emptyBuckets,
    averageNightSleepMinutes: null,
    averageDaySleepMinutes: null,
    averageTotalSleepMinutes: null,
    longestSleep: null,
  }
  const emptyFeed = {
    hasEnoughData: false,
    total: 0,
    byType: { pecho: 0, biberon: 0, solido: 0 },
    pechoSideCounts: { izquierdo: 0, derecho: 0, ambos: 0 },
    averageBottleAmountMl: null,
    averagePechoDurationMinutes: null,
    averageGapMinutes: null,
    averagePerDay: null,
    byHourBucket: emptyBuckets,
    gapStdDevMinutes: null,
  }
  const emptyDiaper = {
    hasEnoughData: false,
    total: 0,
    bySize: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0, unspecified: 0 },
    averagePerDay: null,
    averagePeePerDay: null,
    averagePoopPerDay: null,
    averageGapMinutes: null,
    byHourBucket: emptyBuckets,
    poopColors: { verde: 0, amarillo: 0, marron: 0, meconio: 0, unspecified: 0 },
  }
  const emptyGrowthMetric = {
    points: [],
    latestValue: null,
    latestPercentile: null,
    gained: null,
    weeklyRate: null,
    count: 0,
  }
  const emptyGrowth = {
    weightKg: emptyGrowthMetric,
    heightCm: emptyGrowthMetric,
    headCircumferenceCm: emptyGrowthMetric,
  }

  it('defaults vitamin_d to has_schedule:false when options is omitted entirely - existing call-sites keep working', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth)

    expect(payload.vitamin_d).toEqual({ has_schedule: false, given: 0, total_days: 0 })
  })

  it('maps a real VitaminDStats into snake_case', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth, {
      vitaminD: { hasSchedule: true, given: 42, totalDays: 50 },
    })

    expect(payload.vitamin_d).toEqual({ has_schedule: true, given: 42, total_days: 50 })
  })

  it('defaults period to "all" and last_poop_at to null when omitted', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth)

    expect(payload.period).toBe('all')
    expect(payload.mode).toBe('full')
    expect(payload.questions).toBeNull()
    expect(payload.high_temperatures).toEqual([])
    expect(payload.period_deltas).toBeNull()
    expect(payload.diaper.last_poop_at).toBeNull()
  })

  it('carries the summary mode, questions and high temperatures', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth, {
      mode: 'summary',
      questions: '¿Es normal?',
      highTemperatures: [{ celsius: 38.4, at: '2026-10-10T03:00:00Z' }],
      period: '14d',
    })

    expect(payload.mode).toBe('summary')
    expect(payload.questions).toBe('¿Es normal?')
    expect(payload.high_temperatures).toEqual([{ celsius: 38.4, at: '2026-10-10T03:00:00Z' }])
    expect(payload.period).toBe('14d')
  })

  it('passes the chosen period and last poop through', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth, {
      period: '7d',
      lastPoopAt: '2026-10-10T08:00:00.000Z',
    })

    expect(payload.period).toBe('7d')
    expect(payload.diaper.last_poop_at).toBe('2026-10-10T08:00:00.000Z')
  })

  it('defaults weekly_sleep_by_day to an empty array when omitted', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth)

    expect(payload.weekly_sleep_by_day).toEqual([])
  })

  it('maps dailySleep into snake_case', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth, {
      dailySleep: [
        { date: '2026-10-03', hours: 0 },
        { date: '2026-10-04', hours: 7.5 },
      ],
    })

    expect(payload.weekly_sleep_by_day).toEqual([
      { date: '2026-10-03', hours: 0 },
      { date: '2026-10-04', hours: 7.5 },
    ])
  })

  it('still accepts every option together', () => {
    const payload = buildStatsExportPayload(emptySleep, emptyFeed, emptyDiaper, emptyGrowth, {
      weekComparison: null,
      weeklyTrend: [],
      activityHeatmap: [],
      vitaminD: { hasSchedule: false, given: 0, totalDays: 0 },
      dailySleep: [],
    })

    expect(payload.week_comparison).toBeNull()
    expect(payload.weekly_trend).toEqual([])
    expect(payload.activity_heatmap).toEqual([])
    expect(payload.vitamin_d).toEqual({ has_schedule: false, given: 0, total_days: 0 })
    expect(payload.weekly_sleep_by_day).toEqual([])
  })
})
