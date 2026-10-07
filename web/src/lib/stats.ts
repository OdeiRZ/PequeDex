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

/** A clock time of day, local - not a `Date` (no particular calendar
 * day attached), the result of averaging several real timestamps down
 * to "what time does this usually happen". */
export interface ClockTime {
  hours: number
  minutes: number
}

export function formatClockTime(time: ClockTime): string {
  return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
}

// "Horarios habituales" - a qué hora de reloj suele pasar algo
// (acostarse, despertar, la primera/última toma del día). La media
// aritmética normal no sirve para horas: 23:00 y 01:00 promediarían a
// las 12:00 si se tratan como números sueltos, cuando la hora "típica"
// real está sobre la medianoche. La media CIRCULAR sí - cada hora del
// día es un ángulo sobre un reloj de 24h (360°), se promedian como
// vectores (seno/coseno) y se vuelve a leer el ángulo resultante como
// hora. Estándar para "promediar horas del día" en estadística
// circular, no una invención de esta app.
function circularMeanTimeOfDay(dates: Date[]): ClockTime | null {
  if (dates.length === 0) return null

  let sumSin = 0
  let sumCos = 0
  for (const date of dates) {
    const minutesOfDay = date.getHours() * 60 + date.getMinutes()
    const angle = (minutesOfDay / 1440) * 2 * Math.PI
    sumSin += Math.sin(angle)
    sumCos += Math.cos(angle)
  }

  let meanAngle = Math.atan2(sumSin / dates.length, sumCos / dates.length)
  if (meanAngle < 0) meanAngle += 2 * Math.PI

  const meanMinutes = Math.round((meanAngle / (2 * Math.PI)) * 1440) % 1440
  return { hours: Math.floor(meanMinutes / 60), minutes: meanMinutes % 60 }
}

// Clave de día de calendario LOCAL (no UTC, no un string de fecha que
// dependa del idioma) - solo para agrupar entradas por "qué día es
// esto", nunca mostrada.
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
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
  /** Hora de reloj típica a la que empieza el sueño más largo de cada
   * día (el de la noche, no una siesta - ver `typicalSleepTimes()`).
   * `null` por debajo de `MIN_SAMPLE_SIZE` días distintos con un sueño
   * completado, no solo `MIN_SAMPLE_SIZE` sueños sueltos. */
  typicalBedtime: ClockTime | null
  /** Misma idea, el final de ese mismo sueño más largo del día. */
  typicalWakeTime: ClockTime | null
}

// El sueño más largo de cada día de calendario (del `started_at`) es,
// con mucho, la apuesta más fiable para "el sueño de la noche" frente
// a una siesta, sin necesitar que el cuidador marque nada aparte - una
// siesta rara vez supera en duración al sueño nocturno real. Un umbral
// de MIN_SAMPLE_SIZE días (no sueños sueltos) antes de promediar: con
// menos días, "la hora típica" diría más de lo que los datos
// realmente sostienen, mismo criterio que el resto de "Estadísticas".
function typicalSleepTimes(completed: Sleep[]): {
  bedtime: ClockTime | null
  wakeTime: ClockTime | null
} {
  const longestPerDay = new Map<string, Sleep>()
  for (const sleep of completed) {
    const key = localDayKey(new Date(sleep.started_at))
    const durationMs =
      new Date(sleep.ended_at as string).getTime() - new Date(sleep.started_at).getTime()
    const existing = longestPerDay.get(key)
    const existingDurationMs = existing
      ? new Date(existing.ended_at as string).getTime() - new Date(existing.started_at).getTime()
      : -1
    if (durationMs > existingDurationMs) longestPerDay.set(key, sleep)
  }

  const longest = [...longestPerDay.values()]
  if (longest.length < MIN_SAMPLE_SIZE) return { bedtime: null, wakeTime: null }

  return {
    bedtime: circularMeanTimeOfDay(longest.map((s) => new Date(s.started_at))),
    wakeTime: circularMeanTimeOfDay(longest.map((s) => new Date(s.ended_at as string))),
  }
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
      typicalBedtime: null,
      typicalWakeTime: null,
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

  const { bedtime, wakeTime } = typicalSleepTimes(completed)

  return {
    hasEnoughData: true,
    totalCompleted: completed.length,
    averageDurationMinutes: average(durations),
    averageWakeWindowMinutes: average(wakeWindows),
    byHourBucket: buckets,
    typicalBedtime: bedtime,
    typicalWakeTime: wakeTime,
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
  /** Hora de reloj típica de la primera toma de cada día - `null` por
   * debajo de `MIN_SAMPLE_SIZE` días distintos con alguna toma. */
  typicalFirstFeedTime: ClockTime | null
  /** Misma idea, la última toma de cada día. */
  typicalLastFeedTime: ClockTime | null
}

// `sorted` ya viene ordenado ascendente por started_at (ver más abajo),
// así que basta con quedarse con la primera vez que se ve cada día
// (primera toma) y pisar `last` en cada una siguiente del mismo día
// (la última, sin necesitar comparar manualmente).
function typicalFeedTimes(sorted: Feed[]): { first: ClockTime | null; last: ClockTime | null } {
  const firstPerDay = new Map<string, Feed>()
  const lastPerDay = new Map<string, Feed>()
  for (const feed of sorted) {
    const key = localDayKey(new Date(feed.started_at))
    if (!firstPerDay.has(key)) firstPerDay.set(key, feed)
    lastPerDay.set(key, feed)
  }

  if (firstPerDay.size < MIN_SAMPLE_SIZE) return { first: null, last: null }

  return {
    first: circularMeanTimeOfDay([...firstPerDay.values()].map((f) => new Date(f.started_at))),
    last: circularMeanTimeOfDay([...lastPerDay.values()].map((f) => new Date(f.started_at))),
  }
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
      typicalFirstFeedTime: null,
      typicalLastFeedTime: null,
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

  const { first, last } = typicalFeedTimes(sorted)

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
    typicalFirstFeedTime: first,
    typicalLastFeedTime: last,
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

/**
 * Every other field that ever crosses the API boundary in this app is
 * snake_case (`started_at`, `weight_grams`...) - these four
 * `summarize*Stats()` results are the one exception, kept camelCase as
 * an idiomatic frontend-local convention since they'd never been sent
 * anywhere until the PDF export. This is the one conversion point,
 * building exactly the shape `ExportStatsRequest.php` validates -
 * nothing here is computed, only relabeled.
 */
export interface StatsExportPayload {
  sleep: {
    has_enough_data: boolean
    total_completed: number
    average_duration_minutes: number | null
    average_wake_window_minutes: number | null
    by_hour_bucket: HourBucketStat[]
    typical_bedtime: ClockTime | null
    typical_wake_time: ClockTime | null
  }
  feed: {
    has_enough_data: boolean
    total: number
    by_type: Record<FeedType, number>
    pecho_side_counts: Record<FeedSide, number>
    average_bottle_amount_ml: number | null
    average_pecho_duration_minutes: number | null
    average_gap_minutes: number | null
    average_per_day: number | null
    by_hour_bucket: HourBucketStat[]
    typical_first_feed_time: ClockTime | null
    typical_last_feed_time: ClockTime | null
  }
  diaper: {
    has_enough_data: boolean
    total: number
    by_type: Record<DiaperType, number>
    by_size: Record<DiaperSize | 'unspecified', number>
    average_per_day: number | null
    pee_by_hour_bucket: HourBucketStat[]
    poop_by_hour_bucket: HourBucketStat[]
  }
  growth: {
    weight_kg: GrowthMetricExportStat
    height_cm: GrowthMetricExportStat
    head_circumference_cm: GrowthMetricExportStat
  }
}

interface GrowthMetricExportStat {
  points: GrowthMetricPoint[]
  latest_value: number | null
  latest_percentile: number | null
  gained: number | null
  count: number
}

function exportGrowthMetric(stat: GrowthMetricStat): GrowthMetricExportStat {
  return {
    points: stat.points,
    latest_value: stat.latestValue,
    latest_percentile: stat.latestPercentile,
    gained: stat.gained,
    count: stat.count,
  }
}

export function buildStatsExportPayload(
  sleep: SleepStats,
  feed: FeedStats,
  diaper: DiaperStats,
  growth: GrowthStats,
): StatsExportPayload {
  return {
    sleep: {
      has_enough_data: sleep.hasEnoughData,
      total_completed: sleep.totalCompleted,
      average_duration_minutes: sleep.averageDurationMinutes,
      average_wake_window_minutes: sleep.averageWakeWindowMinutes,
      by_hour_bucket: sleep.byHourBucket,
      typical_bedtime: sleep.typicalBedtime,
      typical_wake_time: sleep.typicalWakeTime,
    },
    feed: {
      has_enough_data: feed.hasEnoughData,
      total: feed.total,
      by_type: feed.byType,
      pecho_side_counts: feed.pechoSideCounts,
      average_bottle_amount_ml: feed.averageBottleAmountMl,
      average_pecho_duration_minutes: feed.averagePechoDurationMinutes,
      average_gap_minutes: feed.averageGapMinutes,
      average_per_day: feed.averagePerDay,
      by_hour_bucket: feed.byHourBucket,
      typical_first_feed_time: feed.typicalFirstFeedTime,
      typical_last_feed_time: feed.typicalLastFeedTime,
    },
    diaper: {
      has_enough_data: diaper.hasEnoughData,
      total: diaper.total,
      by_type: diaper.byType,
      by_size: diaper.bySize,
      average_per_day: diaper.averagePerDay,
      pee_by_hour_bucket: diaper.peeByHourBucket,
      poop_by_hour_bucket: diaper.poopByHourBucket,
    },
    growth: {
      weight_kg: exportGrowthMetric(growth.weightKg),
      height_cm: exportGrowthMetric(growth.heightCm),
      head_circumference_cm: exportGrowthMetric(growth.headCircumferenceCm),
    },
  }
}
