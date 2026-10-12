import type { DiaperChange } from '@/stores/babies'
import { daysBetween, parseDateOnly } from '@/lib/localDate'

// Avisos suaves del Dashboard: nunca diagnostican, solo señalan algo
// que conviene mirar y remiten al pediatra. Umbrales conservadores y
// condicionados a que de verdad se estén registrando pañales - si no,
// "lleva 3 días sin caca" saltaría a quien simplemente no apunta nada.

export type DailyAlert =
  { key: 'noPoop'; days: number; atLeast: boolean } | { key: 'fewWet'; count: number }

export const NO_POOP_DAYS = 3
export const FEW_WET_THRESHOLD = 4
// A partir de esta hora el día ya está lo bastante avanzado como para
// que "solo 2 pañales con pis" signifique algo.
export const FEW_WET_FROM_HOUR = 18
// En los primeros días de vida es normal que haya pocos pañales mojados.
export const FEW_WET_MIN_AGE_DAYS = 5
/** Días que pide el Dashboard al backend para calcular los avisos. */
export const ALERTS_WINDOW_DAYS = 7

const DAY_MS = 86_400_000

/** Los avisos solo miran la hora y el tipo (la lista reciente del API viene compacta). */
type AlertDiaperChange = Pick<DiaperChange, 'changed_at' | 'type'>

function hasPoop(change: AlertDiaperChange): boolean {
  return change.type === 'sucio' || change.type === 'ambos'
}

function hasPee(change: AlertDiaperChange): boolean {
  return change.type === 'mojado' || change.type === 'ambos'
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function computeDailyAlerts(
  /** Los pañales de los últimos `ALERTS_WINDOW_DAYS` días, en cualquier orden. */
  changes: AlertDiaperChange[],
  birthDate: string | null | undefined,
  now: Date = new Date(),
): DailyAlert[] {
  const alerts: DailyAlert[] = []
  const times = changes.map((c) => new Date(c.changed_at).getTime())
  const nowMs = now.getTime()

  // --- Sin caca: solo si se ha registrado algún pañal en las últimas 48 h.
  const loggingRecently = times.some((t) => t >= nowMs - 2 * DAY_MS && t <= nowMs)
  if (loggingRecently) {
    const poopTimes = changes.filter(hasPoop).map((c) => new Date(c.changed_at).getTime())
    if (poopTimes.length > 0) {
      const days = Math.floor((nowMs - Math.max(...poopTimes)) / DAY_MS)
      if (days >= NO_POOP_DAYS) alerts.push({ key: 'noPoop', days, atLeast: false })
    } else {
      // Ninguna caca en todo lo que hay: como mínimo desde el pañal más
      // antiguo de la ventana.
      const days = Math.floor((nowMs - Math.min(...times)) / DAY_MS)
      if (days >= NO_POOP_DAYS) alerts.push({ key: 'noPoop', days, atLeast: true })
    }
  }

  // --- Pocos pañales con pis hoy.
  const ageDays = birthDate ? daysBetween(parseDateOnly(birthDate), now) : null
  if (ageDays !== null && ageDays >= FEW_WET_MIN_AGE_DAYS && now.getHours() >= FEW_WET_FROM_HOUR) {
    const todayStart = startOfDay(now).getTime()
    const prevStart = todayStart - 3 * DAY_MS
    const wetToday = changes.filter(
      (c) => hasPee(c) && new Date(c.changed_at).getTime() >= todayStart,
    ).length
    const loggedBefore = times.filter((t) => t >= prevStart && t < todayStart).length
    // Solo si los 3 días anteriores se apuntaban de media al menos 4
    // pañales al día - señal de que se registran todos.
    if (loggedBefore / 3 >= FEW_WET_THRESHOLD && wetToday < FEW_WET_THRESHOLD) {
      alerts.push({ key: 'fewWet', count: wetToday })
    }
  }

  return alerts
}
