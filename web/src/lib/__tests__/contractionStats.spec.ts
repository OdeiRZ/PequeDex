import { describe, it, expect } from 'vitest'
import { summarizeRecentContractions } from '@/lib/contractionStats'
import type { Contraction } from '@/stores/babies'

function contraction(started: string, ended: string | null, intensity: 0 | 1 | 2 = 0): Contraction {
  return {
    id: Math.random(),
    baby_id: 1,
    user_id: 1,
    started_at: started,
    ended_at: ended,
    intensity,
  }
}

describe('summarizeRecentContractions', () => {
  it('returns all-null stats with no contractions', () => {
    const result = summarizeRecentContractions([], new Date('2026-09-16T15:14:00Z'))

    expect(result).toEqual({ perHour: null, avgDurationSec: null, avgIntervalSec: null })
  })

  it('ignores contractions older than the last 60 minutes', () => {
    const now = new Date('2026-09-16T15:14:00Z')
    const old = contraction('2026-09-16T12:00:00Z', '2026-09-16T12:00:30Z')

    const result = summarizeRecentContractions([old], now)

    expect(result).toEqual({ perHour: null, avgDurationSec: null, avgIntervalSec: null })
  })

  it('counts contractions in the window and averages their duration', () => {
    const now = new Date('2026-09-16T15:14:00Z')
    const contractions = [
      contraction('2026-09-16T15:13:00Z', '2026-09-16T15:13:33Z'),
      contraction('2026-09-16T15:10:00Z', '2026-09-16T15:10:38Z'),
    ]

    const result = summarizeRecentContractions(contractions, now)

    expect(result.perHour).toBe(2)
    expect(result.avgDurationSec).toBeCloseTo((33 + 38) / 2)
  })

  it('averages the gap between consecutive contractions in the window', () => {
    const now = new Date('2026-09-16T15:14:00Z')
    // Three feeds 3 minutes (180s) apart each.
    const contractions = [
      contraction('2026-09-16T15:13:00Z', '2026-09-16T15:13:30Z'),
      contraction('2026-09-16T15:10:00Z', '2026-09-16T15:10:30Z'),
      contraction('2026-09-16T15:07:00Z', '2026-09-16T15:07:30Z'),
    ]

    const result = summarizeRecentContractions(contractions, now)

    expect(result.avgIntervalSec).toBeCloseTo(180)
  })

  it('leaves avgDurationSec null when every contraction in the window is still running', () => {
    const now = new Date('2026-09-16T15:14:00Z')
    const running = contraction('2026-09-16T15:13:00Z', null)

    const result = summarizeRecentContractions([running], now)

    expect(result.perHour).toBe(1)
    expect(result.avgDurationSec).toBeNull()
  })
})
