import { describe, it, expect } from 'vitest'
import { summarizeSleepByDay } from '@/lib/sleepHistory'
import type { Sleep } from '@/stores/babies'

function sleep(started: string, ended: string | null): Sleep {
  return {
    id: Math.random(),
    baby_id: 1,
    user_id: 1,
    started_at: started,
    ended_at: ended,
    notes: null,
  }
}

describe('summarizeSleepByDay', () => {
  it('returns one bucket per day, oldest first, all zero with no sleeps', () => {
    const now = new Date(2026, 7, 31, 12, 0)
    const result = summarizeSleepByDay([], 3, now)

    expect(result).toEqual([
      { date: '2026-08-29', hours: 0 },
      { date: '2026-08-30', hours: 0 },
      { date: '2026-08-31', hours: 0 },
    ])
  })

  it('credits a sleep entirely within one day to that day only', () => {
    const now = new Date(2026, 7, 31, 12, 0)
    const sleeps = [sleep('2026-08-30T14:00:00Z', '2026-08-30T15:30:00Z')]

    const result = summarizeSleepByDay(sleeps, 2, now)

    expect(result.find((d) => d.date === '2026-08-30')?.hours).toBeCloseTo(1.5)
    expect(result.find((d) => d.date === '2026-08-31')?.hours).toBe(0)
  })

  it('splits a sleep that crosses midnight between both days', () => {
    // 23:00 to 02:00 local, 3 hours total - 1 before midnight, 2 after.
    const now = new Date(2026, 7, 31, 12, 0)
    const sleeps = [
      sleep(new Date(2026, 7, 30, 23, 0).toISOString(), new Date(2026, 7, 31, 2, 0).toISOString()),
    ]

    const result = summarizeSleepByDay(sleeps, 2, now)

    expect(result.find((d) => d.date === '2026-08-30')?.hours).toBeCloseTo(1)
    expect(result.find((d) => d.date === '2026-08-31')?.hours).toBeCloseTo(2)
  })

  it('clips an ongoing sleep to "now" instead of the rest of the day', () => {
    const now = new Date(2026, 7, 31, 10, 0)
    const sleeps = [sleep(new Date(2026, 7, 31, 8, 0).toISOString(), null)]

    const result = summarizeSleepByDay(sleeps, 1, now)

    expect(result.find((d) => d.date === '2026-08-31')?.hours).toBeCloseTo(2)
  })
})
