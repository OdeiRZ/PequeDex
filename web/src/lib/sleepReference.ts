import { parseDateOnly } from '@/lib/localDate'
import { formatDurationMinutes } from '@/lib/formatNumber'
import type { TimelineEntry } from '@/stores/babies'

// Referencias de sueño por edad, para comparar el sueño real del bebé
// (Estadísticas, PDF) y orientar el siguiente sueño (Dashboard). Son
// rangos de referencia, no objetivos: cada bebé es distinto, y la app
// lo dice así en pantalla.
//
// Horas totales al día (24 h, siestas incluidas) - fuentes oficiales:
// - 0-3 meses: 14-17 h. National Sleep Foundation, recomendaciones de
//   duración del sueño (Hirshkowitz et al., Sleep Health, 2015).
// - 4-12 meses: 12-16 h; 1-2 años: 11-14 h. Consenso de la American
//   Academy of Sleep Medicine (Paruthi et al., J Clin Sleep Med, 2016),
//   avalado por la Academia Americana de Pediatría.
//
// Ventanas de sueño (tiempo despierto entre sueños) - NO hay una tabla
// oficial (la AAP no publica ninguna); son rangos orientativos de
// práctica clínica. Estos son los de la Cleveland Clinic, revisados por
// una pediatra (Dr. Kristin Barrett). A partir de 12 meses no se da
// referencia.

export interface RangeReference {
  min: number
  max: number
}

export type RangeComparison = 'below' | 'within' | 'above'

/** Mes "medio" de 30,4375 días, como en el cálculo de percentiles. */
export function ageInMonths(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthDate) return null
  const months = (now.getTime() - parseDateOnly(birthDate).getTime()) / (30.4375 * 86_400_000)
  return months >= 0 ? months : null
}

/** Horas de sueño al día recomendadas para la edad, o null fuera de
 * 0-24 meses. `source`: clave i18n corta de la fuente. */
export function totalSleepReference(
  months: number | null,
): (RangeReference & { source: 'nsf' | 'aasm' }) | null {
  if (months === null) return null
  if (months < 4) return { min: 14, max: 17, source: 'nsf' }
  if (months < 12) return { min: 12, max: 16, source: 'aasm' }
  if (months <= 24) return { min: 11, max: 14, source: 'aasm' }
  return null
}

// Límites superiores excluyentes, en meses.
const WAKE_WINDOWS: { below: number; min: number; max: number }[] = [
  { below: 1, min: 30, max: 60 },
  { below: 3, min: 60, max: 120 },
  { below: 5, min: 75, max: 150 },
  { below: 7, min: 120, max: 240 },
  { below: 10, min: 150, max: 270 },
  { below: 12.5, min: 180, max: 360 },
]

/** Tiempo despierto orientativo entre sueños para la edad, en minutos. */
export function wakeWindowReference(months: number | null): RangeReference | null {
  if (months === null) return null
  const row = WAKE_WINDOWS.find((w) => months < w.below)
  return row ? { min: row.min, max: row.max } : null
}

/** "1h", "1h 15min", "45min". */
export function formatMinutesShort(minutes: number): string {
  return formatDurationMinutes(minutes)
}

/** "1h–2h", "1h 15min–2h 30min". */
export function formatWakeRange(range: RangeReference): string {
  return `${formatMinutesShort(range.min)}–${formatMinutesShort(range.max)}`
}

export function compareToRange(value: number, range: RangeReference): RangeComparison {
  if (value < range.min) return 'below'
  if (value > range.max) return 'above'
  return 'within'
}

/** Desde cuándo está despierto: el final del último sueño, si no hay
 * ninguno en curso. Null si está dormido o no hay sueños. */
export function awakeSince(timeline: TimelineEntry[]): Date | null {
  const sleeps = timeline.filter(
    (entry): entry is Extract<TimelineEntry, { type: 'sleep' }> => entry.type === 'sleep',
  )
  if (sleeps.some((entry) => entry.data.ended_at === null)) return null
  const ends = sleeps.map((entry) => new Date(entry.data.ended_at as string).getTime())
  return ends.length > 0 ? new Date(Math.max(...ends)) : null
}
