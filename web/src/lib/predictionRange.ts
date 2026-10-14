import type { PredictionRange } from '@/stores/babies'

/** Fecha y hora de una predicción sin segundos ("12/10/2026, 15:10"): una
 * estimación nunca es tan precisa como para enseñar ":00". */
export function formatPredictionAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Sin rango habitual, cuánto se tolera pasada la hora puntual antes de darla por vencida. */
export const OVERDUE_GRACE_MS = 30 * 60_000

/**
 * ¿La estimación ya está vencida? La hora puntual no basta: "Suele ser entre las
 * 23:12 y las 00:23" sigue siendo cierto a las 23:40 aunque la puntual (23:35) ya
 * pasara, así que se espera al final del rango habitual. Sin rango, la hora
 * puntual más OVERDUE_GRACE_MS. Una estimación vencida no se vuelve a calcular
 * sola (el servidor parte del último evento registrado): si no se avisa, la app
 * sigue enseñando "13/10, 23:35" a la 01:47 como si aún estuviera por llegar.
 */
export function isPredictionOverdue(
  prediction: { at: string; range?: PredictionRange | null },
  now: Date,
): boolean {
  const atMs = new Date(prediction.at).getTime()
  if (Number.isNaN(atMs)) return false

  const toMs = prediction.range ? new Date(prediction.range.to).getTime() : Number.NaN
  const endMs = Number.isNaN(toMs) ? atMs + OVERDUE_GRACE_MS : Math.max(toMs, atMs)

  return now.getTime() > endMs
}

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
