import type { Sleep } from '@/stores/babies'

export interface DaySleepTotal {
  date: string
  hours: number
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Local calendar days, oldest first, so a bar chart reads left-to-right
// as "days ago -> today" - matches how DailyRhythm.vue reasons about
// "today" (the local calendar day, not a rolling 24h window), just
// generalized to `days` of them instead of one. A sleep that overlaps
// more than one bucket (crosses midnight, or is still ongoing) gets
// credited to each day proportionally to the time it actually occupied
// there, not dumped entirely into whichever day it started on.
export function summarizeSleepByDay(
  sleeps: Sleep[],
  days: number,
  now: Date = new Date(),
): DaySleepTotal[] {
  const todayStart = startOfDay(now)
  const buckets: { start: Date; end: Date; date: string }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(todayStart)
    start.setDate(start.getDate() - i)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    buckets.push({ start, end, date: toDateKey(start) })
  }

  const totalsMs = new Map<string, number>(buckets.map((bucket) => [bucket.date, 0]))

  for (const sleep of sleeps) {
    const sleepStart = new Date(sleep.started_at)
    const sleepEnd = sleep.ended_at ? new Date(sleep.ended_at) : now

    for (const bucket of buckets) {
      const overlapStart = sleepStart > bucket.start ? sleepStart : bucket.start
      const overlapEnd = sleepEnd < bucket.end ? sleepEnd : bucket.end
      const overlapMs = overlapEnd.getTime() - overlapStart.getTime()

      if (overlapMs > 0) {
        totalsMs.set(bucket.date, (totalsMs.get(bucket.date) ?? 0) + overlapMs)
      }
    }
  }

  return buckets.map((bucket) => ({
    date: bucket.date,
    hours: (totalsMs.get(bucket.date) ?? 0) / 3_600_000,
  }))
}
