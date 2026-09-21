import type { Contraction } from '@/stores/babies'

export interface ContractionStats {
  perHour: number | null
  avgDurationSec: number | null
  avgIntervalSec: number | null
}

const WINDOW_MS = 60 * 60_000

// Gaps longer than this print as "> 60 min" instead of the literal
// duration, both in ContractionTimeline.vue's interval chips and in
// ContractionsView.vue's live "Desde la última" counter - a gap this
// long is almost never a real measurement, just a pause between labors
// on different days. Same threshold as the backend's
// ContractionsExportController (kept in sync by hand, not shared code -
// nothing else ties a frontend constant to a Laravel one across the
// API boundary in this app).
export const LONG_GAP_MINUTES = 60

// A rolling last-60-minutes window, not the whole history - matches the
// reference app's own "Veces por hora" ("times per hour"). `null` in
// every field with nothing in the window, so the view can render "-"
// instead of a misleading 0. Pure and testable without touching Pinia,
// same spirit as lib/sleepHistory.ts.
export function summarizeRecentContractions(
  contractions: Contraction[],
  now: Date = new Date(),
): ContractionStats {
  const windowStart = now.getTime() - WINDOW_MS

  const recent = contractions
    .filter((c) => new Date(c.started_at).getTime() >= windowStart)
    .slice()
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  if (recent.length === 0) {
    return { perHour: null, avgDurationSec: null, avgIntervalSec: null }
  }

  const durations = recent
    .filter((c) => c.ended_at !== null)
    .map(
      (c) => (new Date(c.ended_at as string).getTime() - new Date(c.started_at).getTime()) / 1000,
    )

  const intervals: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const previousContraction = recent[i - 1]
    const currentContraction = recent[i]
    if (!previousContraction || !currentContraction) continue

    const previous = new Date(previousContraction.started_at).getTime()
    const current = new Date(currentContraction.started_at).getTime()
    intervals.push((current - previous) / 1000)
  }

  const average = (values: number[]): number | null =>
    values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null

  return {
    perHour: recent.length,
    avgDurationSec: average(durations),
    avgIntervalSec: average(intervals),
  }
}
