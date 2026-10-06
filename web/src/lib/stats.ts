import type {
  DiaperChange,
  DiaperSize,
  DiaperType,
  Feed,
  FeedSide,
  FeedType,
  GrowthMeasurement,
  Sleep,
} from '@/stores/babies'

// Mismo umbral que SleepPatternPredictor.php/FeedPatternPredictor.php en
// el backend (MIN_SAMPLE_SIZE) - por debajo, una media o un reparto por
// franjas dice más de lo que los datos realmente sostienen, igual que
// "datos insuficientes" ya se usa en las predicciones de toma/sueño.
const MIN_SAMPLE_SIZE = 3

export type HourBucketKey = 'dawn' | 'morning' | 'afternoon' | 'night'

export const HOUR_BUCKETS: { key: HourBucketKey; startHour: number; endHour: number }[] = [
  { key: 'dawn', startHour: 0, endHour: 6 },
  { key: 'morning', startHour: 6, endHour: 12 },
  { key: 'afternoon', startHour: 12, endHour: 18 },
  { key: 'night', startHour: 18, endHour: 24 },
]

function bucketForHour(hour: number): HourBucketKey {
  const bucket = HOUR_BUCKETS.find((b) => hour >= b.startHour && hour < b.endHour)
  // Unreachable for a real 0-23 hour, but `find` still types as possibly
  // `undefined` - falls back to the first bucket rather than `!`.
  return bucket?.key ?? 'dawn'
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

export interface HourBucketStat {
  key: HourBucketKey
  value: number
}

function emptyBuckets(): HourBucketStat[] {
  return HOUR_BUCKETS.map((b) => ({ key: b.key, value: 0 }))
}

export interface SleepStats {
  hasEnoughData: boolean
  totalCompleted: number
  averageDurationMinutes: number | null
  byHourBucket: HourBucketStat[]
}

// Bucketed by the hour each sleep STARTS, not a proportional split
// across every hour it overlaps (unlike summarizeSleepByDay's day
// buckets) - simpler, and "a qué hora suele empezar a dormir" is the
// more useful read for "franjas más tranquilas" than minute-by-minute
// overlap would add here.
export function summarizeSleepStats(sleeps: Sleep[], now: Date = new Date()): SleepStats {
  const completed = sleeps.filter((s) => s.ended_at !== null)

  if (completed.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      totalCompleted: completed.length,
      averageDurationMinutes: null,
      byHourBucket: emptyBuckets(),
    }
  }

  const durations = completed.map(
    (s) => (new Date(s.ended_at as string).getTime() - new Date(s.started_at).getTime()) / 60_000,
  )

  const buckets = emptyBuckets()
  for (const sleep of completed) {
    const startedAt = new Date(sleep.started_at)
    const endedAt = sleep.ended_at ? new Date(sleep.ended_at) : now
    const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000
    const bucket = buckets.find((b) => b.key === bucketForHour(startedAt.getHours()))
    if (bucket) bucket.value += minutes
  }

  return {
    hasEnoughData: true,
    totalCompleted: completed.length,
    averageDurationMinutes: average(durations),
    byHourBucket: buckets,
  }
}

export interface FeedStats {
  hasEnoughData: boolean
  total: number
  byType: Record<FeedType, number>
  pechoSideCounts: Record<FeedSide, number>
  averageBottleAmountMl: number | null
  averagePechoDurationMinutes: number | null
  byHourBucket: HourBucketStat[]
}

export function summarizeFeedStats(feeds: Feed[]): FeedStats {
  const byType: Record<FeedType, number> = { pecho: 0, biberon: 0, solido: 0 }
  const pechoSideCounts: Record<FeedSide, number> = { izquierdo: 0, derecho: 0, ambos: 0 }
  const bottleAmounts: number[] = []
  const pechoDurations: number[] = []
  const buckets = emptyBuckets()

  for (const feed of feeds) {
    byType[feed.type]++

    if (feed.type === 'pecho' && feed.side) {
      pechoSideCounts[feed.side]++
    }
    if (feed.type === 'biberon' && feed.amount_ml !== null) {
      bottleAmounts.push(feed.amount_ml)
    }
    if (feed.type === 'pecho' && feed.ended_at) {
      pechoDurations.push(
        (new Date(feed.ended_at).getTime() - new Date(feed.started_at).getTime()) / 60_000,
      )
    }

    const bucket = buckets.find(
      (b) => b.key === bucketForHour(new Date(feed.started_at).getHours()),
    )
    if (bucket) bucket.value++
  }

  if (feeds.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      total: feeds.length,
      byType,
      pechoSideCounts,
      averageBottleAmountMl: null,
      averagePechoDurationMinutes: null,
      byHourBucket: emptyBuckets(),
    }
  }

  return {
    hasEnoughData: true,
    total: feeds.length,
    byType,
    pechoSideCounts,
    averageBottleAmountMl: average(bottleAmounts),
    averagePechoDurationMinutes: average(pechoDurations),
    byHourBucket: buckets,
  }
}

export interface DiaperStats {
  hasEnoughData: boolean
  total: number
  byType: Record<DiaperType, number>
  bySize: Record<DiaperSize | 'unspecified', number>
  peeByHourBucket: HourBucketStat[]
  poopByHourBucket: HourBucketStat[]
}

export function summarizeDiaperStats(changes: DiaperChange[]): DiaperStats {
  const byType: Record<DiaperType, number> = { mojado: 0, sucio: 0, ambos: 0 }
  const bySize: Record<DiaperSize | 'unspecified', number> = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6+': 0,
    unspecified: 0,
  }
  const peeByHourBucket = emptyBuckets()
  const poopByHourBucket = emptyBuckets()

  for (const change of changes) {
    byType[change.type]++
    bySize[change.size ?? 'unspecified']++

    const hourBucket = bucketForHour(new Date(change.changed_at).getHours())
    if (change.type === 'mojado' || change.type === 'ambos') {
      const bucket = peeByHourBucket.find((b) => b.key === hourBucket)
      if (bucket) bucket.value++
    }
    if (change.type === 'sucio' || change.type === 'ambos') {
      const bucket = poopByHourBucket.find((b) => b.key === hourBucket)
      if (bucket) bucket.value++
    }
  }

  if (changes.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      total: changes.length,
      byType,
      bySize,
      peeByHourBucket: emptyBuckets(),
      poopByHourBucket: emptyBuckets(),
    }
  }

  return {
    hasEnoughData: true,
    total: changes.length,
    byType,
    bySize,
    peeByHourBucket,
    poopByHourBucket,
  }
}

export interface GrowthMetricPoint {
  date: string
  value: number
  percentile: number | null
}

export interface GrowthMetricStat {
  points: GrowthMetricPoint[]
  latestValue: number | null
  latestPercentile: number | null
  /** Latest minus first, same unit as `points[].value` - `null` with
   * fewer than two points, where "gained" isn't a trend yet, just a
   * single reading. */
  gained: number | null
  count: number
}

function growthMetricStat(
  measurements: GrowthMeasurement[],
  valueOf: (m: GrowthMeasurement) => number | null,
  percentileOf: (m: GrowthMeasurement) => number | null,
): GrowthMetricStat {
  const points = measurements
    .map((m) => ({ date: m.measured_at, value: valueOf(m), percentile: percentileOf(m) }))
    .filter((p): p is GrowthMetricPoint => p.value !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (points.length === 0) {
    return { points: [], latestValue: null, latestPercentile: null, gained: null, count: 0 }
  }

  const first = points[0] as GrowthMetricPoint
  const latest = points[points.length - 1] as GrowthMetricPoint

  return {
    points,
    latestValue: latest.value,
    latestPercentile: latest.percentile,
    gained: points.length > 1 ? latest.value - first.value : null,
    count: points.length,
  }
}

export interface GrowthStats {
  weightKg: GrowthMetricStat
  heightCm: GrowthMetricStat
  headCircumferenceCm: GrowthMetricStat
}

// No MIN_SAMPLE_SIZE gate here, unlike the other summarize*Stats above -
// growth is measured occasionally by nature (a weekly/monthly
// check-in, not several times a day), so even a single reading is
// worth showing (just without a "gained" trend, which needs two).
// weight_grams converts to kg for display, same as DashboardView.vue's
// own growthWeightKg handling - grams is the storage/wire unit, kg is
// what the form and this page both show.
export function summarizeGrowthStats(measurements: GrowthMeasurement[]): GrowthStats {
  return {
    weightKg: growthMetricStat(
      measurements,
      (m) => (m.weight_grams !== null ? m.weight_grams / 1000 : null),
      (m) => m.weight_percentile,
    ),
    heightCm: growthMetricStat(
      measurements,
      (m) => m.height_cm,
      (m) => m.height_percentile,
    ),
    headCircumferenceCm: growthMetricStat(
      measurements,
      (m) => m.head_circumference_cm,
      (m) => m.head_circumference_percentile,
    ),
  }
}
