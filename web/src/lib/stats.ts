import type { RangeComparison } from '@/lib/sleepReference'
import type {
  DiaperChange,
  DiaperResidueColor,
  DiaperSize,
  Feed,
  FeedSide,
  FeedType,
  GrowthMeasurement,
  Sleep,
  Temperature,
  Vaccination,
  Checkup,
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

// --- Periodo ---
// Un bebé cambia muchísimo en pocas semanas: una media sobre todo el
// historial mezcla los primeros días (hospital) con los actuales y
// describe a un bebé que ya no existe. Las secciones de tomas, sueño y
// pañales se calculan sobre el periodo elegido (por defecto, los
// últimos 7 días); tendencia semanal, mapa de actividad y crecimiento
// siguen usando todo el historial, que es justo lo que miden.
// '14d' no está en el selector de la pantalla: es la ventana fija del
// "Resumen para la consulta" (el PDF corto para el pediatra).
export type StatsPeriod = '7d' | '14d' | '30d' | 'all'

const PERIOD_DAYS: Record<Exclude<StatsPeriod, 'all'>, number> = { '7d': 7, '14d': 14, '30d': 30 }

/** "Completo": el PDF de siempre. "Resumen": una página para la consulta. */
export type StatsExportMode = 'full' | 'summary'

export const SUMMARY_PERIOD: StatsPeriod = '14d'

// Inicio (medianoche local) del primer día del periodo: "últimos 7
// días" = hoy y los 6 anteriores, días de calendario completos.
export function periodStart(period: StatsPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (PERIOD_DAYS[period] - 1))
  return start
}

export function filterByPeriod<T>(
  items: T[],
  at: (item: T) => string,
  period: StatsPeriod,
  now: Date = new Date(),
): T[] {
  const start = periodStart(period, now)
  if (start === null) return items
  return items.filter((item) => new Date(at(item)) >= start)
}

// El periodo inmediatamente anterior, del mismo número de días: con "7
// días" (hoy y los 6 anteriores), los 7 días de calendario justo antes.
// Vacío con "Todo" - no hay "antes de todo" con el que comparar.
export function filterPreviousPeriod<T>(
  items: T[],
  at: (item: T) => string,
  period: StatsPeriod,
  now: Date = new Date(),
): T[] {
  if (period === 'all') return []
  const end = periodStart(period, now) as Date
  const start = new Date(end)
  start.setDate(start.getDate() - PERIOD_DAYS[period])
  return items.filter((item) => {
    const date = new Date(at(item))
    return date >= start && date < end
  })
}

/** Diferencia (periodo actual menos el anterior) de las cifras donde la
 * evolución dice algo; `null` si cualquiera de los dos periodos no
 * tiene ese dato (p. ej. el anterior sin datos suficientes). */
export interface PeriodDeltas {
  longestStretchMinutes: number | null
  totalSleepMinutes: number | null
  feedsPerDay: number | null
  peePerDay: number | null
  poopPerDay: number | null
}

function delta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? current - previous : null
}

export function summarizePeriodDeltas(
  current: { sleep: SleepStats; feed: FeedStats; diaper: DiaperStats },
  previous: { sleep: SleepStats; feed: FeedStats; diaper: DiaperStats },
): PeriodDeltas {
  return {
    longestStretchMinutes: delta(
      current.sleep.averageLongestStretchMinutes,
      previous.sleep.averageLongestStretchMinutes,
    ),
    totalSleepMinutes: delta(
      current.sleep.averageTotalSleepMinutes,
      previous.sleep.averageTotalSleepMinutes,
    ),
    feedsPerDay: delta(current.feed.averagePerDay, previous.feed.averagePerDay),
    peePerDay: delta(current.diaper.averagePeePerDay, previous.diaper.averagePeePerDay),
    poopPerDay: delta(current.diaper.averagePoopPerDay, previous.diaper.averagePoopPerDay),
  }
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
function daysSpanned(timestamps: string[]): number {
  const times = timestamps.map((t) => new Date(t).getTime())
  const minMs = Math.min(...times)
  const maxMs = Math.max(...times)
  return Math.floor((maxMs - minMs) / 86_400_000) + 1
}

function averagePerDay(timestamps: string[]): number | null {
  if (timestamps.length === 0) return null
  return timestamps.length / daysSpanned(timestamps)
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
  averageDurationMinutes: number | null
  /** Time awake between one sleep ending and the next starting - `null`
   * with fewer than two completed sleeps, or if every gap was long
   * enough to look like an overnight stretch rather than a real
   * wake window (see `MAX_WAKE_WINDOW_HOURS`). */
  averageWakeWindowMinutes: number | null
  /** Sueños al día - cuánto de fragmentado está el sueño, no el total
   * de registros (que solo crece con el tiempo y no dice nada). */
  averageSleepsPerDay: number | null
  /** El sueño seguido más largo de cada día, de media - el indicador de
   * "empieza a dormir del tirón". `null` por debajo de
   * `MIN_SAMPLE_SIZE` días distintos con un sueño completado. */
  averageLongestStretchMinutes: number | null
  byHourBucket: HourBucketStat[]
  /** Minutos al día dormidos dentro de la franja nocturna (20:00-08:00)
   * frente al resto - por franja de reloj, no "el sueño más largo
   * cuenta como noche": un bebé no tiene un único sueño nocturno, y
   * eso es justo lo que este reparto debe poder enseñar. */
  averageNightSleepMinutes: number | null
  averageDaySleepMinutes: number | null
  /** Suma de los dos anteriores - el total de sueño al día, la
   * pregunta más directa de todas ("¿duerme lo que toca?"). */
  averageTotalSleepMinutes: number | null
  /** El sueño individual más largo del periodo, con su fecha - un dato
   * de "récord", no una media; útil como ficha destacada aparte. */
  longestSleep: { minutes: number; date: string } | null
}

function sleepDurationMs(sleep: Sleep): number {
  return new Date(sleep.ended_at as string).getTime() - new Date(sleep.started_at).getTime()
}

// Franja nocturna fija de reloj: de 20:00 a 08:00 del día siguiente.
const NIGHT_START_HOUR = 20
const NIGHT_END_HOUR = 8

function overlapMs(start: Date, end: Date, windowStart: Date, windowEnd: Date): number {
  const from = start > windowStart ? start : windowStart
  const to = end < windowEnd ? end : windowEnd
  return Math.max(0, to.getTime() - from.getTime())
}

// Cuánto de [start, end) cae en la franja nocturna, repartido día a día
// (un sueño de 19:00 a 23:00 cuenta 3h de noche y 1h de día).
function nightMs(start: Date, end: Date): number {
  let total = 0
  const day = new Date(start)
  day.setHours(0, 0, 0, 0)
  while (day < end) {
    const morningEnd = new Date(day)
    morningEnd.setHours(NIGHT_END_HOUR)
    const eveningStart = new Date(day)
    eveningStart.setHours(NIGHT_START_HOUR)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    total += overlapMs(start, end, day, morningEnd) + overlapMs(start, end, eveningStart, nextDay)
    day.setDate(day.getDate() + 1)
  }
  return total
}

function groupByStartDay(completed: Sleep[]): Map<string, Sleep[]> {
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

function averageLongestStretch(completed: Sleep[]): number | null {
  const byDay = groupByStartDay(completed)
  if (byDay.size < MIN_SAMPLE_SIZE) return null
  return average(
    [...byDay.values()].map(
      (daySleeps) => Math.max(...daySleeps.map((s) => sleepDurationMs(s))) / 60_000,
    ),
  )
}

// Minutos al día de noche/de día/en total, divididos por los días que
// cubren los sueños - no por sueño ni por "días con sueño registrado".
function dailySleepSplit(completed: Sleep[]): {
  nightMinutes: number | null
  dayMinutes: number | null
  totalMinutes: number | null
} {
  if (groupByStartDay(completed).size < MIN_SAMPLE_SIZE) {
    return { nightMinutes: null, dayMinutes: null, totalMinutes: null }
  }

  let totalMs = 0
  let nightTotalMs = 0
  for (const sleep of completed) {
    const start = new Date(sleep.started_at)
    const end = new Date(sleep.ended_at as string)
    totalMs += end.getTime() - start.getTime()
    nightTotalMs += nightMs(start, end)
  }

  const days = daysSpanned(completed.map((s) => s.started_at))
  const totalMinutes = totalMs / 60_000 / days
  const nightMinutes = nightTotalMs / 60_000 / days
  return { nightMinutes, dayMinutes: totalMinutes - nightMinutes, totalMinutes }
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
      averageDurationMinutes: null,
      averageWakeWindowMinutes: null,
      averageSleepsPerDay: null,
      averageLongestStretchMinutes: null,
      byHourBucket: emptyBuckets(),
      averageNightSleepMinutes: null,
      averageDaySleepMinutes: null,
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

  const { nightMinutes, dayMinutes, totalMinutes } = dailySleepSplit(completed)

  return {
    hasEnoughData: true,
    averageDurationMinutes: average(durations),
    averageWakeWindowMinutes: average(wakeWindows),
    averageSleepsPerDay: averagePerDay(completed.map((s) => s.started_at)),
    averageLongestStretchMinutes: averageLongestStretch(completed),
    byHourBucket: buckets,
    averageNightSleepMinutes: nightMinutes,
    averageDaySleepMinutes: dayMinutes,
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

// Lo que se registra es el cambio de pañal y lo que había dentro, no el
// momento en que hizo pis o caca - y casi siempre hay las dos cosas.
// Así que no se reparte en "mojado/sucio/ambos" (un % que sobre todo
// refleja cómo se catalogó cada cambio), sino que cada cambio cuenta
// como "con pis" (mojado o ambos) y/o "con caca" (sucio o ambos).
function hasPee(change: DiaperChange): boolean {
  return change.type === 'mojado' || change.type === 'ambos'
}

function hasPoop(change: DiaperChange): boolean {
  return change.type === 'sucio' || change.type === 'ambos'
}

export interface DiaperStats {
  hasEnoughData: boolean
  total: number
  bySize: Record<DiaperSize | 'unspecified', number>
  /** Cambios al día de media sobre los días que cubre el periodo. */
  averagePerDay: number | null
  /** Pañales con pis al día - el indicador de hidratación que usan los
   * pediatras. Mismo denominador de días que `averagePerDay`. */
  averagePeePerDay: number | null
  /** Pañales con caca al día. */
  averagePoopPerDay: number | null
  /** Tiempo medio entre un cambio y el siguiente - "cada cuánto se
   * cambia", el mismo corte de `MAX_FEED_GAP_HOURS` que las tomas para
   * no contar el tirón de la noche ni un registro olvidado. */
  averageGapMinutes: number | null
  /** Cambios por franja horaria - es la hora del cambio, no la de la
   * deposición, así que no se separa en pis/caca. */
  byHourBucket: HourBucketStat[]
  /** Color registrado en los pañales con caca del periodo. */
  poopColors: Record<DiaperResidueColor | 'unspecified', number>
}

export function summarizeDiaperStats(changes: DiaperChange[]): DiaperStats {
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
  const poopColors: Record<DiaperResidueColor | 'unspecified', number> = {
    verde: 0,
    amarillo: 0,
    marron: 0,
    meconio: 0,
    unspecified: 0,
  }
  const byHourBucket = emptyBuckets()

  for (const change of changes) {
    bySize[change.size ?? 'unspecified']++
    if (hasPoop(change)) poopColors[change.residue_color ?? 'unspecified']++

    const bucket = byHourBucket.find(
      (b) => b.key === bucketForHour(new Date(change.changed_at).getHours()),
    )
    if (bucket) bucket.value++
  }

  if (changes.length < MIN_SAMPLE_SIZE) {
    return {
      hasEnoughData: false,
      total: changes.length,
      bySize,
      averagePerDay: null,
      averagePeePerDay: null,
      averagePoopPerDay: null,
      averageGapMinutes: null,
      byHourBucket: emptyBuckets(),
      poopColors,
    }
  }

  const days = daysSpanned(changes.map((c) => c.changed_at))
  const times = changes.map((c) => new Date(c.changed_at).getTime()).sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) {
    const gapMinutes = ((times[i] as number) - (times[i - 1] as number)) / 60_000
    if (gapMinutes > 0 && gapMinutes <= MAX_FEED_GAP_HOURS * 60) gaps.push(gapMinutes)
  }

  return {
    hasEnoughData: true,
    total: changes.length,
    bySize,
    averagePerDay: changes.length / days,
    averagePeePerDay: changes.filter(hasPee).length / days,
    averagePoopPerDay: changes.filter(hasPoop).length / days,
    averageGapMinutes: average(gaps),
    byHourBucket,
    poopColors,
  }
}

// Sobre TODO el historial, no el periodo elegido: "hace cuánto fue la
// última caca" es una pregunta sobre ahora, y en un periodo de 7 días
// sin ninguna no tendría respuesta justo cuando más importa.
export function findLastPoopAt(changes: DiaperChange[]): string | null {
  let latest: string | null = null
  for (const change of changes) {
    if (hasPoop(change) && (latest === null || change.changed_at > latest)) {
      latest = change.changed_at
    }
  }
  return latest
}

// --- Temperatura ---
// Sin MIN_SAMPLE_SIZE: no es una media de hábitos, es un registro
// puntual de cuando el bebé está malito - una sola medición ya cuenta.

export interface TemperatureStats {
  count: number
  max: { celsius: number; at: string } | null
  /** Mediciones de 38 °C o más (`FEVER_THRESHOLD_CELSIUS`). */
  highCount: number
  latest: { celsius: number; at: string } | null
  /** Las mediciones del periodo, de la más antigua a la más reciente,
   * para la gráfica de Estadísticas y del PDF - como mucho las
   * `MAX_TEMPERATURE_READINGS` más recientes. */
  readings: { celsius: number; at: string }[]
}

export const MAX_TEMPERATURE_READINGS = 200

export function summarizeTemperatureStats(
  temperatures: Temperature[],
  feverThreshold = 38,
): TemperatureStats {
  let max: TemperatureStats['max'] = null
  let latest: TemperatureStats['latest'] = null
  let highCount = 0
  for (const t of temperatures) {
    if (max === null || t.celsius > max.celsius) max = { celsius: t.celsius, at: t.measured_at }
    if (latest === null || t.measured_at > latest.at)
      latest = { celsius: t.celsius, at: t.measured_at }
    if (t.celsius >= feverThreshold) highCount++
  }
  const readings = temperatures
    .map((t) => ({ celsius: t.celsius, at: t.measured_at }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-MAX_TEMPERATURE_READINGS)
  return { count: temperatures.length, max, highCount, latest, readings }
}

// --- Vacunas y revisiones ---
// Fechas de calendario, sin franjas horarias que dependan de la zona -
// pero se resume aquí igualmente para que el PDF reciba lo mismo que se
// ve en pantalla, como el resto de bloques.

export interface VaccinationStats {
  given: number
  /** Las no opcionales, más las opcionales que sí se pusieron. */
  total: number
  overdue: number
  givenList: { name: string; date: string }[]
  /** Las próximas pendientes (no opcionales), como mucho 5. */
  upcomingList: { name: string; date: string | null }[]
  nextCheckup: { reason: string | null; at: string } | null
}

export function summarizeVaccinationStats(
  vaccinations: Vaccination[],
  checkups: Checkup[],
  now: Date = new Date(),
): VaccinationStats {
  const todayKey = toDateOnlyString(now)
  const givenList = vaccinations
    .filter((v) => v.given_at)
    .map((v) => ({ name: v.name, date: v.given_at as string }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const pending = vaccinations.filter((v) => !v.given_at && !v.optional)
  const nextCheckup = checkups
    .filter((c) => new Date(c.scheduled_at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]

  return {
    given: givenList.length,
    total: vaccinations.filter((v) => !v.optional || v.given_at).length,
    overdue: pending.filter((v) => v.due_date !== null && v.due_date < todayKey).length,
    givenList,
    upcomingList: pending.slice(0, 5).map((v) => ({ name: v.name, date: v.due_date })),
    nextCheckup: nextCheckup ? { reason: nextCheckup.reason, at: nextCheckup.scheduled_at } : null,
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
  /** Media, sobre los días de esa semana con algún sueño completado, del
   * sueño seguido más largo de cada día - la misma cifra que "Tramo más
   * largo" del bloque de Sueño, semana a semana: "¿empieza a dormir del
   * tirón?". `null` sin ningún sueño completado esa semana. */
  longestStretchMinutes: number | null
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
  interface WeekAccumulator {
    sleepMinutes: number
    hasSleep: boolean
    /** Sueño más largo de cada día (clave local del día de inicio). */
    longestByDay: Map<string, number>
    feedCount: number
    diaperCount: number
  }
  const weeks = new Map<string, WeekAccumulator>()

  function weekOf(date: Date): WeekAccumulator {
    const key = toDateOnlyString(mondayOf(date))
    let week = weeks.get(key)
    if (!week) {
      week = {
        sleepMinutes: 0,
        hasSleep: false,
        longestByDay: new Map(),
        feedCount: 0,
        diaperCount: 0,
      }
      weeks.set(key, week)
    }
    return week
  }

  for (const sleep of sleeps) {
    if (!sleep.ended_at) continue
    const start = new Date(sleep.started_at)
    const week = weekOf(start)
    const minutes = (new Date(sleep.ended_at).getTime() - start.getTime()) / 60_000
    week.sleepMinutes += minutes
    week.hasSleep = true
    const dayKey = localDayKey(start)
    week.longestByDay.set(dayKey, Math.max(week.longestByDay.get(dayKey) ?? 0, minutes))
  }
  for (const feed of feeds) weekOf(new Date(feed.started_at)).feedCount++
  for (const change of diaperChanges) weekOf(new Date(change.changed_at)).diaperCount++

  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, w]) => ({
      weekStart,
      sleepHours: w.hasSleep ? w.sleepMinutes / 60 : null,
      longestStretchMinutes: average([...w.longestByDay.values()]),
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
  mode: StatsExportMode
  /** Solo en el resumen: las preguntas que el cuidador quiere hacer. */
  questions: string | null
  /** Solo en el resumen: las temperaturas de 38 °C o más del periodo. */
  high_temperatures: { celsius: number; at: string }[]
  period: StatsPeriod
  period_deltas: {
    longest_stretch_minutes: number | null
    total_sleep_minutes: number | null
    feeds_per_day: number | null
    pee_per_day: number | null
    poop_per_day: number | null
  } | null
  sleep: {
    has_enough_data: boolean
    average_duration_minutes: number | null
    average_wake_window_minutes: number | null
    average_sleeps_per_day: number | null
    average_longest_stretch_minutes: number | null
    by_hour_bucket: HourBucketStat[]
    average_night_sleep_minutes: number | null
    average_day_sleep_minutes: number | null
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
    by_size: Record<DiaperSize | 'unspecified', number>
    average_per_day: number | null
    average_pee_per_day: number | null
    average_poop_per_day: number | null
    average_gap_minutes: number | null
    by_hour_bucket: HourBucketStat[]
    poop_colors: Record<DiaperResidueColor | 'unspecified', number>
    last_poop_at: string | null
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
    longest_stretch_minutes: number | null
    feed_count: number
    diaper_count: number
  }[]
  /** `null` si el bebé no tiene ninguna temperatura registrada nunca -
   * así el PDF no saca una sección vacía a quien no usa la función. */
  temperature: {
    count: number
    max: { celsius: number; at: string } | null
    high_count: number
    latest: { celsius: number; at: string } | null
    readings: { celsius: number; at: string }[]
    /** Inicio del eje X de la gráfica: el del periodo, o la primera
     * medición con "Todo". */
    from: string | null
  } | null
  /** `null` si "Vacunas y revisiones" no está activado para el bebé. */
  vaccinations: {
    given: number
    total: number
    overdue: number
    given_list: { name: string; date: string }[]
    upcoming_list: { name: string; date: string | null }[]
    next_checkup: { reason: string | null; at: string } | null
  } | null
  activity_heatmap: { day_of_week: number; hour: number; count: number }[]
  vitamin_d: { has_schedule: boolean; given: number; total_days: number }
  weekly_sleep_by_day: { date: string; hours: number }[]
  /** Referencias por edad (lib/sleepReference.ts); null sin fecha de
   * nacimiento o fuera de rango de edad. */
  sleep_reference: {
    total: {
      min: number
      max: number
      source: 'nsf' | 'aasm'
      verdict: RangeComparison | null
    } | null
    wake_window: { min: number; max: number; verdict: RangeComparison | null } | null
  } | null
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
  mode?: StatsExportMode
  questions?: string | null
  highTemperatures?: { celsius: number; at: string }[]
  period?: StatsPeriod
  periodDeltas?: PeriodDeltas | null
  lastPoopAt?: string | null
  temperature?: TemperatureStats | null
  vaccinations?: VaccinationStats | null
  weekComparison?: WeekComparison | null
  weeklyTrend?: WeeklyTrendPoint[]
  activityHeatmap?: HeatmapCell[]
  vitaminD?: VitaminDStats
  dailySleep?: DaySleepTotal[]
  sleepReference?: StatsExportPayload['sleep_reference']
}

export function buildStatsExportPayload(
  sleep: SleepStats,
  feed: FeedStats,
  diaper: DiaperStats,
  growth: GrowthStats,
  options: StatsExportOptions = {},
): StatsExportPayload {
  const {
    mode = 'full',
    questions = null,
    highTemperatures = [],
    period = 'all',
    periodDeltas = null,
    lastPoopAt = null,
    temperature = null,
    vaccinations = null,
    weekComparison = null,
    weeklyTrend = [],
    activityHeatmap = [],
    vitaminD = { hasSchedule: false, given: 0, totalDays: 0 },
    dailySleep = [],
    sleepReference = null,
  } = options

  return {
    mode,
    questions,
    high_temperatures: highTemperatures,
    period,
    period_deltas: periodDeltas
      ? {
          longest_stretch_minutes: periodDeltas.longestStretchMinutes,
          total_sleep_minutes: periodDeltas.totalSleepMinutes,
          feeds_per_day: periodDeltas.feedsPerDay,
          pee_per_day: periodDeltas.peePerDay,
          poop_per_day: periodDeltas.poopPerDay,
        }
      : null,
    sleep: {
      has_enough_data: sleep.hasEnoughData,
      average_duration_minutes: sleep.averageDurationMinutes,
      average_wake_window_minutes: sleep.averageWakeWindowMinutes,
      average_sleeps_per_day: sleep.averageSleepsPerDay,
      average_longest_stretch_minutes: sleep.averageLongestStretchMinutes,
      by_hour_bucket: sleep.byHourBucket,
      average_night_sleep_minutes: sleep.averageNightSleepMinutes,
      average_day_sleep_minutes: sleep.averageDaySleepMinutes,
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
      by_size: diaper.bySize,
      average_per_day: diaper.averagePerDay,
      average_pee_per_day: diaper.averagePeePerDay,
      average_poop_per_day: diaper.averagePoopPerDay,
      average_gap_minutes: diaper.averageGapMinutes,
      by_hour_bucket: diaper.byHourBucket,
      poop_colors: diaper.poopColors,
      last_poop_at: lastPoopAt,
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
      longest_stretch_minutes: w.longestStretchMinutes,
      feed_count: w.feedCount,
      diaper_count: w.diaperCount,
    })),
    temperature: temperature
      ? {
          count: temperature.count,
          max: temperature.max,
          high_count: temperature.highCount,
          latest: temperature.latest,
          readings: temperature.readings,
          from: periodStart(period)?.toISOString() ?? temperature.readings[0]?.at ?? null,
        }
      : null,
    vaccinations: vaccinations
      ? {
          given: vaccinations.given,
          total: vaccinations.total,
          overdue: vaccinations.overdue,
          given_list: vaccinations.givenList,
          upcoming_list: vaccinations.upcomingList,
          next_checkup: vaccinations.nextCheckup,
        }
      : null,
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
    sleep_reference: sleepReference,
  }
}
