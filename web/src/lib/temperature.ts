import type { Temperature } from '@/stores/babies'
import { parseDateOnly } from '@/lib/localDate'

export const RECENT_TEMPERATURE_HOURS = 48

/** Las mediciones de las últimas `hours` horas, de la más antigua a la
 * más reciente (el orden de la minigráfica). */
export function recentTemperatures(
  temperatures: Temperature[],
  now: Date = new Date(),
  hours: number = RECENT_TEMPERATURE_HOURS,
): Temperature[] {
  const since = now.getTime() - hours * 3_600_000
  return temperatures
    .filter((t) => {
      const at = new Date(t.measured_at).getTime()
      return at >= since && at <= now.getTime()
    })
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
}

// Menos de 3 meses cumplidos (mismo día del mes, 3 meses después) - en
// esa edad la indicación habitual de los pediatras ante fiebre es
// consultar siempre, por eso la tarjeta muestra un aviso fijo.
export function isUnderThreeMonths(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!birthDate) return false
  const threeMonths = parseDateOnly(birthDate)
  threeMonths.setMonth(threeMonths.getMonth() + 3)
  return now < threeMonths
}
