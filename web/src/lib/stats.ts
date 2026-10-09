import type {
  DiaperChange,
  DiaperSize,
  DiaperType,
  Feed,
  FeedSide,
  FeedType,
  GrowthMeasurement,
  Sleep,
  VitaminDDose,
  VitaminDSchedule,
} from '@/stores/babies'
import { daysBetween, parseDateOnly, toDateOnlyString } from '@/lib/localDate'
import type { DaySleepTotal } from '@/lib/sleepHistory'

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

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = average(values) as number
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
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
  /** Minutos de media al día en el sueño más largo del día (el de la
   * noche) frente al resto (siestas) - "¿cuánto duerme de noche frente
   * a de día?", no solo una hora de reloj suelta. Mismo umbral de días
   * distintos que `typicalBedtime`/`typicalWakeTime`. */
  averageNightSleepMinutes: number | null
  averageNapMinutes: number | null
  /** Suma de los dos anteriores - el total de sueño al día, la
   * pregunta más directa de todas ("¿duerme lo que toca?"). */
  averageTotalSleepMinutes: number | null
  /** El sueño individual más largo jamás registrado, con su fecha - un
   * dato de "récord", no una media; útil como ficha destacada aparte. */
  longestSleep: { minutes: number; date: string } | null
}

function sleepDurationMs(sleep: Sleep): number {
  return new Date(sleep.ended_at as string).getTime() - new Date(sleep.started_at).getTime()
}

// El sueño más largo de cada día de calendario (del `started_at`) es,
// con mucho, la apuesta más fiable para "el sueño de la noche" frente
// a una siesta, sin necesitar que el cuidador marque nada aparte - una
// siesta rara vez supera en duración al sueño nocturno real. Agrupa
// una vez, reutilizado tanto por `typicalSleepTimes()` (la hora a la
// que ese sueño empieza/acaba) como por `dailySleepSplit()` (cuántos
// minutos es ese sueño frente al resto del día).
function longestSleepPerDay(completed: Sleep[]): Map<string, Sleep[]> {
  const byDay = new Map<string, Sleep[]>()
  for (const sleep of completed) {
    const key = localDayKey(new Date(sleep.started_at))
    const existing = byDay.get(key)
    if (existing) {
      existing.push(sleep)
    } else {
      byDay.set(key, [sleep])
    }
  }
  return byDay
}

// Un umbral de MIN_SAMPLE_SIZE días (no sueños sueltos) antes de
// promediar: con menos días, "la hora típica" diría más de lo que los
// datos realmente sostienen, mismo criterio que el resto de
// "Estadísticas".
function typicalSleepTimes(byDay: Map<string, Sleep[]>): {
  bedtime: ClockTime | null
  wakeTime: ClockTime | null
} {
  if (byDay.size < MIN_SAMPLE_SIZE) return { bedtime: null, wakeTime: null }

  const longestPerDay = [...byDay.values()].map((daySleeps) =>
    daySleeps.reduce((a, b) => (sleepDurationMs(b) > sleepDurationMs(a) ? b : a)),
  )

  return {
    bedtime: circularMeanTimeOfDay(longestPerDay.map((s) => new Date(s.started_at))),
    wakeTime: circularMeanTimeOfDay(longestPerDay.map((s) => new Date(s.ended_at as string))),
  }
}

// "¿Cuánto duerme de noche frente a de día?" - el sueño más largo de
// cada día (ver más arriba) cuenta como sueño de noche, el resto (una
// o varias siestas) como sueño de día; se suman los minutos de cada
// grupo por día y se promedia across días, no se mezclan sueños
// sueltos de días distintos.
function dailySleepSplit(byDay: Map<string, Sleep[]>): {
  nightMinutes: number | null
  napMinutes: number | null
  totalMinutes: number | null
} {
  if (byDay.size < MIN_SAMPLE_SIZE)
    return { nightMinutes: null, napMinutes: null, totalMinutes: null }

  const nightPerDay: number[] = []
  const napPerDay: number[] = []
  for (const daySleeps of byDay.values()) {
    const longest = daySleeps.reduce((a, b) => (sleepDurationMs(b) > sleepDurationMs(a) ? b : a))
    let napMs = 0
    for (const sleep of daySleeps) {
      if (sleep !== longest) napMs += sleepDurationMs(sleep)
    }
    nightPerDay.push(sleepDurationMs(longest) / 60_000)
    napPerDay.push(napMs / 60_000)
  }

  const nightMinutes = average(nightPerDay)
  const napMinutes = average(napPerDay)
  return {
    nightMinutes,
    napMinutes,
    totalMinutes: nightMinutes !== null && napMinutes !== null ? nightMinutes + napMinutes : null,
  }
}

function findLongestSleep(completed: Sleep[]): { minutes: number; date: string } | null {
  if (completed.length === 0) return null
  const longest = completed.reduce((a, b) => (sleepDurationMs(b) > sleepDurationMs(a) ? b : a))
  return { minutes: Math.round(sleepDurationMs(longest) / 60_000), date: longest.started_at }
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
      averageNightSleepMinutes: null,
      averageNapMinutes: null,
      averageTotalSleepMinutes: null,
      longestSleep: findLongestSleep(completed),
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

  const byDay = longestSleepPerDay(completed)
  const { bedtime, wakeTime } = typicalSleepTimes(byDay)
  const { nightMinutes, napMinutes, totalMinutes } = dailySleepSplit(byDay)

  return {
    hasEnoughData: true,
    totalCompleted: completed.length,
    averageDurationMinutes: average(durations),
    averageWakeWindowMinutes: average(wakeWindows),
    byHourBucket: buckets,
    typicalBedtime: bedtime,
    typicalWakeTime: wakeTime,
    averageNightSleepMinutes: nightMinutes,
    averageNapMinutes: napMinutes,
    averageTotalSleepMinutes: totalMinutes,
    longestSleep: findLongestSleep(completed),
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
  /** Cuánto varía el intervalo entre tomas (desviación típica de los
   * mismos huecos que promedia `averageGapMinutes`) - "qué tan regular
   * es el horario", no solo "cada cuánto". `null` con menos de dos
   * huecos útiles, igual que `averageGapMinutes`. */
  gapStdDevMinutes: number | null
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
      gapStdDevMinutes: null,
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
    gapStdDevMinutes: standardDeviation(gaps),
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
  /** Pañales mojados (o "ambos") al día de media - un indicador real
   * que usan los pediatras para valorar si el bebé come suficiente,
   * sobre todo en recién nacidos, no solo "cuántos pañales en total". */
  averageWetPerDay: number | null
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
      averageWetPerDay: null,
      peeByHourBucket: emptyBuckets(),
      poopByHourBucket: emptyBuckets(),
    }
  }

  const wetTimestamps = changes
    .filter((c) => c.type === 'mojado' || c.type === 'ambos')
    .map((c) => c.changed_at)

  return {
    hasEnoughData: true,
    total: changes.length,
    byType,
    bySize,
    averagePerDay: averagePerDay(changes.map((c) => c.changed_at)),
    averageWetPerDay: averagePerDay(wetTimestamps),
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
  /** `gained`, normalizado a "por semana" sobre el tiempo real entre el
   * primer y el último registro - la velocidad de crecimiento, no solo
   * el total acumulado (que crece sin más con el tiempo aunque el
   * ritmo real se haya frenado). `null` igual que `gained`, o si el
   * primer y el último registro caen el mismo día (nada que dividir). */
  weeklyRate: number | null
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
    return {
      points: [],
      latestValue: null,
      latestPercentile: null,
      gained: null,
      weeklyRate: null,
      count: 0,
    }
  }

  const first = points[0] as GrowthMetricPoint
  const latest = points[points.length - 1] as GrowthMetricPoint
  const gained = points.length > 1 ? latest.value - first.value : null
  const daysBetween =
    points.length > 1
      ? (new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86_400_000
      : 0

  return {
    points,
    latestValue: latest.value,
    latestPercentile: latest.percentile,
    gained,
    weeklyRate: gained !== null && daysBetween > 0 ? (gained / daysBetween) * 7 : null,
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

// --- Tendencia semanal y mapa de actividad ---
// Las dos únicas piezas de "Estadísticas" que no cruzan nunca al PDF -
// un gráfico de líneas/barras y una rejilla 7x24 no tienen un
// equivalente razonable en una plantilla dompdf (ver el resto de esta
// sección: hasta las franjas horarias, mucho más simples, ya salen como
// fichas de texto, no un gráfico dibujado). Pantalla únicamente.

export interface WeeklyTrendPoint {
  /** "YYYY-MM-DD" del lunes de esa semana (semana ISO, lunes-domingo) -
   * clave estable para ordenar y para usar como `:key` de lista. */
  weekStart: string
  /** Horas totales de sueño completado esa semana - `null`, no `0`,
   * cuando no hubo ningún sueño completado, para no leer "no hay
   * registro" como "no durmió nada". */
  sleepHours: number | null
  feedCount: number
  diaperCount: number
}

function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = result.getDay() // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  return result
}

// Sin umbral MIN_SAMPLE_SIZE, a diferencia del resto de esta sección -
// es un gráfico de tendencia, no una media/reparto puntual; una semana
// con poco dato simplemente se ve más baja/vacía en el propio gráfico,
// eso ya es información (igual que el gráfico de Crecimiento, que
// tampoco exige un mínimo de mediciones).
export function summarizeWeeklyTrend(
  sleeps: Sleep[],
  feeds: Feed[],
  diaperChanges: DiaperChange[],
): WeeklyTrendPoint[] {
  const weeks = new Map<
    string,
    { sleepMinutes: number; hasSleep: boolean; feedCount: number; diaperCount: number }
  >()

  function weekOf(date: Date): {
    sleepMinutes: number
    hasSleep: boolean
    feedCount: number
    diaperCount: number
  } {
    const key = toDateOnlyString(mondayOf(date))
    let week = weeks.get(key)
    if (!week) {
      week = { sleepMinutes: 0, hasSleep: false, feedCount: 0, diaperCount: 0 }
      weeks.set(key, week)
    }
    return week
  }

  for (const sleep of sleeps) {
    if (!sleep.ended_at) continue
    const week = weekOf(new Date(sleep.started_at))
    week.sleepMinutes +=
      (new Date(sleep.ended_at).getTime() - new Date(sleep.started_at).getTime()) / 60_000
    week.hasSleep = true
  }
  for (const feed of feeds) weekOf(new Date(feed.started_at)).feedCount++
  for (const change of diaperChanges) weekOf(new Date(change.changed_at)).diaperCount++

  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, w]) => ({
      weekStart,
      sleepHours: w.hasSleep ? w.sleepMinutes / 60 : null,
      feedCount: w.feedCount,
      diaperCount: w.diaperCount,
    }))
}

export interface WeekComparisonMetric {
  current: number
  delta: number
}

export interface WeekComparison {
  weekStart: string
  sleepHours: WeekComparisonMetric | null
  feedCount: WeekComparisonMetric
  diaperCount: WeekComparisonMetric
}

// "Esta semana frente a la anterior" - comparar la semana EN CURSO
// (todavía sin terminar, con menos días transcurridos que una semana
// completa) contra la anterior casi siempre saldría "a la baja" solo
// por el calendario, no porque nada haya cambiado de verdad (un
// martes, la semana en curso lleva 2 días de tomas frente a los 7 de
// la semana completa anterior). Se compara la ÚLTIMA SEMANA YA
// COMPLETA (su domingo ya pasado) contra la anterior a esa, nunca la
// que todavía está en marcha.
export function summarizeWeekComparison(
  trend: WeeklyTrendPoint[],
  now: Date = new Date(),
): WeekComparison | null {
  const complete = trend.filter((w) => {
    const sunday = new Date(`${w.weekStart}T00:00:00`)
    sunday.setDate(sunday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return sunday.getTime() < now.getTime()
  })

  if (complete.length < 2) return null

  const current = complete[complete.length - 1] as WeeklyTrendPoint
  const previous = complete[complete.length - 2] as WeeklyTrendPoint

  return {
    weekStart: current.weekStart,
    sleepHours:
      current.sleepHours !== null && previous.sleepHours !== null
        ? { current: current.sleepHours, delta: current.sleepHours - previous.sleepHours }
        : null,
    feedCount: { current: current.feedCount, delta: current.feedCount - previous.feedCount },
    diaperCount: {
      current: current.diaperCount,
      delta: current.diaperCount - previous.diaperCount,
    },
  }
}

export interface HeatmapCell {
  /** 0=lunes .. 6=domingo - mismo criterio de "la semana empieza en
   * lunes" que `mondayOf()` de arriba, no el 0=domingo nativo de
   * `Date#getDay()`. */
  dayOfWeek: number
  hour: number
  count: number
}

// Densidad combinada de toma+sueño+pañal por día de la semana/hora -
// "¿cuándo pasan cosas de verdad?", mucho más fino que las 4 franjas de
// 6h de `HOUR_BUCKETS` y sin mezclar días distintos entre sí (al
// contrario que esas franjas, que sí agregan todos los días juntos).
export function summarizeActivityHeatmap(
  sleeps: Sleep[],
  feeds: Feed[],
  diaperChanges: DiaperChange[],
): HeatmapCell[] {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[])

  function mark(date: Date): void {
    const dayOfWeek = (date.getDay() + 6) % 7
    const row = grid[dayOfWeek] as number[]
    row[date.getHours()] = (row[date.getHours()] ?? 0) + 1
  }

  for (const sleep of sleeps) mark(new Date(sleep.started_at))
  for (const feed of feeds) mark(new Date(feed.started_at))
  for (const change of diaperChanges) mark(new Date(change.changed_at))

  const cells: HeatmapCell[] = []
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ dayOfWeek, hour, count: (grid[dayOfWeek] as number[])[hour] ?? 0 })
    }
  }
  return cells
}

export interface VitaminDStats {
  hasSchedule: boolean
  given: number
  totalDays: number
}

// No MIN_SAMPLE_SIZE gate here - this is an exact count ("92/100"), not
// an average that needs a minimum sample to mean anything.
// hasSchedule:false hides the section for "never activated", a
// different reason than the other stats' "not enough data yet".
export function summarizeVitaminDStats(
  schedule: VitaminDSchedule | null,
  doses: VitaminDDose[],
  now: Date = new Date(),
): VitaminDStats {
  if (!schedule) {
    return { hasSchedule: false, given: 0, totalDays: 0 }
  }

  const today = toDateOnlyString(now)
  const effectiveEnd = schedule.end_date < today ? schedule.end_date : today
  const totalDays = Math.max(
    0,
    daysBetween(parseDateOnly(schedule.start_date), parseDateOnly(effectiveEnd)) + 1,
  )
  const given = doses.filter(
    (d) => d.given && d.date >= schedule.start_date && d.date <= effectiveEnd,
  ).length

  return { hasSchedule: true, given, totalDays }
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
    average_night_sleep_minutes: number | null
    average_nap_minutes: number | null
    average_total_sleep_minutes: number | null
    longest_sleep: { minutes: number; date: string } | null
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
    gap_std_dev_minutes: number | null
  }
  diaper: {
    has_enough_data: boolean
    total: number
    by_type: Record<DiaperType, number>
    by_size: Record<DiaperSize | 'unspecified', number>
    average_per_day: number | null
    average_wet_per_day: number | null
    pee_by_hour_bucket: HourBucketStat[]
    poop_by_hour_bucket: HourBucketStat[]
  }
  growth: {
    weight_kg: GrowthMetricExportStat
    height_cm: GrowthMetricExportStat
    head_circumference_cm: GrowthMetricExportStat
  }
  week_comparison: {
    sleep_hours: { current: number; delta: number } | null
    feed_count: { current: number; delta: number }
    diaper_count: { current: number; delta: number }
  } | null
  weekly_trend: {
    week_start: string
    sleep_hours: number | null
    feed_count: number
    diaper_count: number
  }[]
  activity_heatmap: { day_of_week: number; hour: number; count: number }[]
  vitamin_d: { has_schedule: boolean; given: number; total_days: number }
  weekly_sleep_by_day: { date: string; hours: number }[]
}

interface GrowthMetricExportStat {
  points: GrowthMetricPoint[]
  latest_value: number | null
  latest_percentile: number | null
  gained: number | null
  weekly_rate: number | null
  count: number
}

function exportGrowthMetric(stat: GrowthMetricStat): GrowthMetricExportStat {
  return {
    points: stat.points,
    latest_value: stat.latestValue,
    latest_percentile: stat.latestPercentile,
    gained: stat.gained,
    weekly_rate: stat.weeklyRate,
    count: stat.count,
  }
}

/**
 * Everything beyond the four always-present blocks (sleep/feed/diaper/
 * growth) - optional because an older or simpler caller might not have
 * them computed, each defaulting to its own "nothing here" shape. This
 * replaced a growing chain of positional parameters (weekComparison,
 * weeklyTrend, activityHeatmap, vitaminD...) once a 9th metric
 * (dailySleep) made that chain unreadable - the options object scales
 * to new metrics without touching existing call-sites' argument order.
 */
export interface StatsExportOptions {
  weekComparison?: WeekComparison | null
  weeklyTrend?: WeeklyTrendPoint[]
  activityHeatmap?: HeatmapCell[]
  vitaminD?: VitaminDStats
  dailySleep?: DaySleepTotal[]
}

export function buildStatsExportPayload(
  sleep: SleepStats,
  feed: FeedStats,
  diaper: DiaperStats,
  growth: GrowthStats,
  options: StatsExportOptions = {},
): StatsExportPayload {
  const {
    weekComparison = null,
    weeklyTrend = [],
    activityHeatmap = [],
    vitaminD = { hasSchedule: false, given: 0, totalDays: 0 },
    dailySleep = [],
  } = options

  return {
    sleep: {
      has_enough_data: sleep.hasEnoughData,
      total_completed: sleep.totalCompleted,
      average_duration_minutes: sleep.averageDurationMinutes,
      average_wake_window_minutes: sleep.averageWakeWindowMinutes,
      by_hour_bucket: sleep.byHourBucket,
      typical_bedtime: sleep.typicalBedtime,
      typical_wake_time: sleep.typicalWakeTime,
      average_night_sleep_minutes: sleep.averageNightSleepMinutes,
      average_nap_minutes: sleep.averageNapMinutes,
      average_total_sleep_minutes: sleep.averageTotalSleepMinutes,
      longest_sleep: sleep.longestSleep,
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
      gap_std_dev_minutes: feed.gapStdDevMinutes,
    },
    diaper: {
      has_enough_data: diaper.hasEnoughData,
      total: diaper.total,
      by_type: diaper.byType,
      by_size: diaper.bySize,
      average_per_day: diaper.averagePerDay,
      average_wet_per_day: diaper.averageWetPerDay,
      pee_by_hour_bucket: diaper.peeByHourBucket,
      poop_by_hour_bucket: diaper.poopByHourBucket,
    },
    growth: {
      weight_kg: exportGrowthMetric(growth.weightKg),
      height_cm: exportGrowthMetric(growth.heightCm),
      head_circumference_cm: exportGrowthMetric(growth.headCircumferenceCm),
    },
    week_comparison: weekComparison
      ? {
          sleep_hours: weekComparison.sleepHours,
          feed_count: weekComparison.feedCount,
          diaper_count: weekComparison.diaperCount,
        }
      : null,
    weekly_trend: weeklyTrend.map((w) => ({
      week_start: w.weekStart,
      sleep_hours: w.sleepHours,
      feed_count: w.feedCount,
      diaper_count: w.diaperCount,
    })),
    activity_heatmap: activityHeatmap.map((c) => ({
      day_of_week: c.dayOfWeek,
      hour: c.hour,
      count: c.count,
    })),
    vitamin_d: {
      has_schedule: vitaminD.hasSchedule,
      given: vitaminD.given,
      total_days: vitaminD.totalDays,
    },
    weekly_sleep_by_day: dailySleep.map((d) => ({ date: d.date, hours: d.hours })),
  }
}
