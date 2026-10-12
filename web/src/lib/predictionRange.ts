import type { PredictionRange } from '@/stores/babies'

/** Las horas ("14:10") del rango habitual de una predicción, o null si el
 * servidor no lo da (pocos datos). El orden se garantiza: desde <= hasta. */
export function formatPredictionRange(
  range: PredictionRange | null | undefined,
  locale: string,
): { from: string; to: string } | null {
  if (!range) return null
  const fromMs = new Date(range.from).getTime()
  const toMs = new Date(range.to).getTime()
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null

  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return { from: time(Math.min(fromMs, toMs)), to: time(Math.max(fromMs, toMs)) }
}
