import { parseDateOnly } from '@/lib/localDate'

/** Una fila mes a mes (0-24) de las curvas de referencia de la OMS, tal
 * cual las devuelve `GET /babies/{id}/growth-reference`. */
export interface GrowthReferenceRow {
  month: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

export interface GrowthReferenceCurves {
  weight: GrowthReferenceRow[]
  height: GrowthReferenceRow[]
  head_circumference: GrowthReferenceRow[]
}

export interface ReferenceSample {
  /** Instante (ms) al que corresponde esta muestra. */
  at: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

// Mes "medio" de 30,4375 días, el mismo que usa el backend para calcular
// el percentil de cada medición - así la curva y el percentil cuadran.
const MS_PER_MONTH = 30.4375 * 86_400_000
const KEYS = ['p3', 'p15', 'p50', 'p85', 'p97'] as const

function interpolateAt(rows: GrowthReferenceRow[], month: number): Omit<ReferenceSample, 'at'> {
  const lower = rows[Math.floor(month)] as GrowthReferenceRow
  const upper = rows[Math.ceil(month)] as GrowthReferenceRow
  const fraction = month - Math.floor(month)
  const sample = {} as Omit<ReferenceSample, 'at'>
  for (const key of KEYS) sample[key] = lower[key] + (upper[key] - lower[key]) * fraction
  return sample
}

/**
 * Muestras de las curvas dentro de [startMs, endMs]: los dos extremos
 * (interpolados) y cada mes entero de por medio, para dibujar las bandas
 * solo en el tramo de fechas que cubre la gráfica. Vacío si el bebé no
 * tiene fecha de nacimiento o el tramo cae fuera de 0-24 meses (fuera de
 * las tablas no se inventa nada).
 */
export function referenceSamples(
  rows: GrowthReferenceRow[] | null | undefined,
  birthDate: string | null | undefined,
  startMs: number,
  endMs: number,
): ReferenceSample[] {
  if (!rows || rows.length === 0 || !birthDate) return []

  const birthMs = parseDateOnly(birthDate).getTime()
  const maxMonth = (rows[rows.length - 1] as GrowthReferenceRow).month
  const fromMonth = Math.max(0, (startMs - birthMs) / MS_PER_MONTH)
  const toMonth = Math.min(maxMonth, (endMs - birthMs) / MS_PER_MONTH)
  if (toMonth < fromMonth) return []

  const months = [fromMonth]
  for (let m = Math.floor(fromMonth) + 1; m < toMonth; m++) months.push(m)
  if (toMonth > fromMonth) months.push(toMonth)

  return months.map((month) => ({
    at: birthMs + month * MS_PER_MONTH,
    ...interpolateAt(rows, month),
  }))
}
