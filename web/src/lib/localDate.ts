// Plain "YYYY-MM-DD" helpers for the "Ritmo" day navigator - the whole
// point is browsing calendar days as the user perceives them locally
// (the same local-midnight boundary DailyRhythm.vue already uses for
// "today"), so these stay in local time throughout, never touching
// `toISOString()` directly (that's UTC, and would drift the shown day
// by one near midnight depending on the browser's timezone).
import { parseDateOnly } from './babyAge'

export { parseDateOnly }

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateOnlyString(): string {
  return toDateOnlyString(new Date())
}

export function addDays(dateOnly: string, delta: number): string {
  const date = parseDateOnly(dateOnly)
  date.setDate(date.getDate() + delta)
  return toDateOnlyString(date)
}
