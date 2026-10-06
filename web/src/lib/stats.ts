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

// Entries per calendar day across the whole span the data covers, not
// per 24h rolling window - the span is inclusive of both the first and
// last day an entry fell on (`+ 1`), so a single day's worth of
// entries reads as "N that day", not "N per 0 days" (division by
// zero). Not requested explicitly, but "cuántas tomas/pañales al día"
// is the natural follow-up question once "cada cuánto" (the gap) is
// already on screen - same underlying data, no extra fetch.
function averagePerDay(timestamps: string[]): number | null {
  if (timestamps.length === 0) return null

  const times = timestamps.map((t) => new Date(t).getTime())
  const minMs = Math.min(...times)
  const maxMs = Math.max(...times)
  const days = Math.floor((maxMs - minMs) / 86_400_000) + 1

  return timestamps.length / days
}

export interface HourBucketStat {
  key: HourBucketKey
  value: number
}

function emptyBuckets(): HourBucketStat[] {
  return HOUR_BUCKETS.map((b) => ({ key: b.key, value: 0 }))
}

// Same cutoff as SleepPatternPredictor.php's MAX_WAKE_WINDOW_HOURS - a
// gap this long is almost always an overnight stretch, not a real
// nap-to-nap wake window, and would drag the average hours off if
// counted the same as a daytime gap.
const MAX_WAKE_WINDOW_HOURS = 6

export interface SleepStats {
  hasEnoughData: boolean
  totalCompleted: number
  averageDurationMinutes: number | null
  /** Time awake between one sleep ending and the next starting - `null`
   * with fewer than two completed sleeps, or if every gap was long
   * enough to look like an overnight stretch rather than a real
   * wake window (see `MAX_WAKE_WINDOW_HOURS`). */
  averageWakeWindowMinutes: number | null
  byHourBucket: HourBucketStat[]
}

// Bucketed by the hour each sleep STARTS, not a proportional split
// across every hour it overlaps (unlike summarizeSleepByDay's day
// buckets) - simpler, and "a qué hora suele empezar a dormir" is the
// more useful read for "franjas más tranquilas" than minute-by-minute
// overlap would add here.
export function summarizeSleepStats(sleeps: Sleep[], now: Date = new Date()): SleepStats {
  const completed = sleeps
    .filter((s) => s.ended_at !== null)
    .slice()
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  if (completed.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      totalCompleted: completed.length,
      averageDurationMinutes: null,
      averageWakeWindowMinutes: null,
      byHourBucket: emptyBuckets(),
    }
  }

  const durations = completed.map(
    (s) => (new Date(s.ended_at as string).getTime() - new Date(s.started_at).getTime()) / 60_000,
  )

  const wakeWindows: number[] = []
  for (let i = 1; i < completed.length; i++) {
    const previous = completed[i - 1] as Sleep
    const current = completed[i] as Sleep
    const gapMinutes =
      (new Date(current.started_at).getTime() - new Date(previous.ended_at as string).getTime()) /
      60_000
    if (gapMinutes > 0 && gapMinutes <= MAX_WAKE_WINDOW_HOURS * 60) {
      wakeWindows.push(gapMinutes)
    }
  }

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
    averageWakeWindowMinutes: average(wakeWindows),
    byHourBucket: buckets,
  }
}

// Same cutoff as FeedPatternPredictor.php's MAX_GAP_HOURS - wider than
// sleep's wake-window cutoff since feeds are typically closer together
// than naps; a gap this long almost always means an overnight stretch
// or a genuinely missed log, not the baby's real feeding rhythm.
const MAX_FEED_GAP_HOURS = 8

export interface FeedStats {
  hasEnoughData: boolean
  total: number
  byType: Record<FeedType, number>
  pechoSideCounts: Record<FeedSide, number>
  averageBottleAmountMl: number | null
  averagePechoDurationMinutes: number | null
  /** Time between the start of one feed and the next, across every
   * type (not just pecho) - "cada cuánto come". `null` with fewer than
   * two feeds, or if every gap looked like an overnight stretch (see
   * `MAX_FEED_GAP_HOURS`). */
  averageGapMinutes: number | null
  /** Feeds per calendar day across the whole logged span - "cuántas
   * tomas al día de media". `null` below the sample threshold, same as
   * everything else here. */
  averagePerDay: number | null
  byHourBucket: HourBucketStat[]
}

export function summarizeFeedStats(feeds: Feed[]): FeedStats {
  const byType: Record<FeedType, number> = { pecho: 0, biberon: 0, solido: 0 }
  const pechoSideCounts: Record<FeedSide, number> = { izquierdo: 0, derecho: 0, ambos: 0 }
  const bottleAmounts: number[] = []
  const pechoDurations: number[] = []
  const buckets = emptyBuckets()

  const sorted = feeds
    .slice()
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  for (const feed of sorted) {
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

  if (sorted.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      total: sorted.length,
      byType,
      pechoSideCounts,
      averageBottleAmountMl: null,
      averagePechoDurationMinutes: null,
      averageGapMinutes: null,
      averagePerDay: null,
      byHourBucket: emptyBuckets(),
    }
  }

  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1] as Feed
    const current = sorted[i] as Feed
    const gapMinutes =
      (new Date(current.started_at).getTime() - new Date(previous.started_at).getTime()) / 60_000
    if (gapMinutes > 0 && gapMinutes <= MAX_FEED_GAP_HOURS * 60) {
      gaps.push(gapMinutes)
    }
  }

  return {
    hasEnoughData: true,
    total: sorted.length,
    byType,
    pechoSideCounts,
    averageBottleAmountMl: average(bottleAmounts),
    averagePechoDurationMinutes: average(pechoDurations),
    averageGapMinutes: average(gaps),
    averagePerDay: averagePerDay(sorted.map((f) => f.started_at)),
    byHourBucket: buckets,
  }
}

export interface DiaperStats {
  hasEnoughData: boolean
  total: number
  byType: Record<DiaperType, number>
  bySize: Record<DiaperSize | 'unspecified', number>
  /** Changes per calendar day across the whole logged span - "cuántos
   * pañales al día de media". */
  averagePerDay: number | null
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
      averagePerDay: null,
      peeByHourBucket: emptyBuckets(),
      poopByHourBucket: emptyBuckets(),
    }
  }

  return {
    hasEnoughData: true,
    total: changes.length,
    byType,
    bySize,
    averagePerDay: averagePerDay(changes.map((c) => c.changed_at)),
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
