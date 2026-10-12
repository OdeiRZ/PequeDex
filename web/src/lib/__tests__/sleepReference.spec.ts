import { describe, it, expect } from 'vitest'
import {
  ageInMonths,
  awakeSince,
  compareToRange,
  totalSleepReference,
  wakeWindowReference,
} from '@/lib/sleepReference'
import type { TimelineEntry } from '@/stores/babies'

function sleep(startedAt: string, endedAt: string | null): TimelineEntry {
  return {
    type: 'sleep',
    at: startedAt,
    data: { id: 1, baby_id: 1, user_id: 1, started_at: startedAt, ended_at: endedAt, notes: null },
  }
}

describe('ageInMonths', () => {
  it('uses the average 30.4375-day month and is null without a birth date', () => {
    expect(ageInMonths('2026-08-01', new Date(2026, 9, 1))).toBeCloseTo(61 / 30.4375)
    expect(ageInMonths(null)).toBeNull()
    expect(ageInMonths('2027-01-01', new Date(2026, 9, 1))).toBeNull()
  })
})

describe('totalSleepReference', () => {
  it('follows the NSF range under 4 months and the AASM ranges after', () => {
    expect(totalSleepReference(1)).toEqual({ min: 14, max: 17, source: 'nsf' })
    expect(totalSleepReference(6)).toEqual({ min: 12, max: 16, source: 'aasm' })
    expect(totalSleepReference(18)).toEqual({ min: 11, max: 14, source: 'aasm' })
    expect(totalSleepReference(30)).toBeNull()
    expect(totalSleepReference(null)).toBeNull()
  })
})

describe('wakeWindowReference', () => {
  it('gives the orientative range for the age, none past 12 months', () => {
    expect(wakeWindowReference(0.5)).toEqual({ min: 30, max: 60 })
    expect(wakeWindowReference(2)).toEqual({ min: 60, max: 120 })
    expect(wakeWindowReference(4)).toEqual({ min: 75, max: 150 })
    expect(wakeWindowReference(8)).toEqual({ min: 150, max: 270 })
    expect(wakeWindowReference(11)).toEqual({ min: 180, max: 360 })
    expect(wakeWindowReference(14)).toBeNull()
  })
})

describe('compareToRange', () => {
  it('reads below, within and above', () => {
    expect(compareToRange(13, { min: 14, max: 17 })).toBe('below')
    expect(compareToRange(15, { min: 14, max: 17 })).toBe('within')
    expect(compareToRange(17.5, { min: 14, max: 17 })).toBe('above')
  })
})

describe('awakeSince', () => {
  it('returns the end of the latest sleep, or null while asleep', () => {
    expect(
      awakeSince([
        sleep('2026-10-12T06:00:00Z', '2026-10-12T07:00:00Z'),
        sleep('2026-10-12T09:00:00Z', '2026-10-12T10:00:00Z'),
      ])?.toISOString(),
    ).toBe('2026-10-12T10:00:00.000Z')
    expect(awakeSince([sleep('2026-10-12T09:00:00Z', null)])).toBeNull()
    expect(awakeSince([])).toBeNull()
  })
})
