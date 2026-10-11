import { describe, it, expect } from 'vitest'
import { isUnderThreeMonths, recentTemperatures } from '@/lib/temperature'
import { summarizeTemperatureStats } from '@/lib/stats'
import {
  entryTemperatureBadge,
  entryTemperatureHigh,
  entryTitle,
  formatCelsius,
} from '@/lib/timelineEntry'
import type { Temperature, TimelineEntry } from '@/stores/babies'

function temperature(
  celsius: number,
  measuredAt: string,
  overrides: Partial<Temperature> = {},
): Temperature {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    measured_at: measuredAt,
    celsius,
    method: null,
    notes: null,
    ...overrides,
  }
}

const now = new Date('2026-10-11T12:00:00Z')

describe('recentTemperatures', () => {
  it('keeps the last 48 hours, oldest first', () => {
    const result = recentTemperatures(
      [
        temperature(38.5, '2026-10-11T08:00:00Z', { id: 3 }),
        temperature(37.0, '2026-10-09T11:00:00Z', { id: 1 }), // > 48 h
        temperature(37.8, '2026-10-10T20:00:00Z', { id: 2 }),
      ],
      now,
    )
    expect(result.map((t) => t.id)).toEqual([2, 3])
  })
})

describe('isUnderThreeMonths', () => {
  it('is true until the same day of the month three months later', () => {
    expect(isUnderThreeMonths('2026-07-12', new Date(2026, 9, 11))).toBe(true)
    expect(isUnderThreeMonths('2026-07-11', new Date(2026, 9, 11))).toBe(false)
  })

  it('is false without a birth date', () => {
    expect(isUnderThreeMonths(null)).toBe(false)
  })
})

describe('summarizeTemperatureStats', () => {
  it('counts readings, readings at 38 °C or more, the highest and the latest', () => {
    const stats = summarizeTemperatureStats([
      temperature(37.2, '2026-10-10T08:00:00Z'),
      temperature(38.6, '2026-10-10T22:00:00Z'),
      temperature(38.0, '2026-10-11T06:00:00Z'),
    ])
    expect(stats).toEqual({
      count: 3,
      highCount: 2,
      max: { celsius: 38.6, at: '2026-10-10T22:00:00Z' },
      latest: { celsius: 38.0, at: '2026-10-11T06:00:00Z' },
    })
  })

  it('is empty with no readings', () => {
    expect(summarizeTemperatureStats([])).toEqual({
      count: 0,
      highCount: 0,
      max: null,
      latest: null,
    })
  })
})

describe('temperature timeline entries', () => {
  const t = (key: string) => key
  const entry = (celsius: number): TimelineEntry => ({
    type: 'temperature',
    at: '2026-10-11T08:00:00Z',
    data: temperature(celsius, '2026-10-11T08:00:00Z', { method: 'axila' }),
  })

  it('formats the value with one decimal in the locale', () => {
    expect(formatCelsius(38, 'es-ES')).toBe('38,0 °C')
    expect(formatCelsius(37.45, 'en-GB')).toBe('37.5 °C')
  })

  it('marks 38 °C or more with a neutral badge only', () => {
    expect(entryTemperatureHigh(entry(38))).toBe(true)
    expect(entryTemperatureBadge(entry(38), t)).toBe('dashboard.timeline.feverBadge')
    expect(entryTemperatureBadge(entry(37.9), t)).toBeUndefined()
  })

  it('builds the title from the value and method label', () => {
    expect(
      entryTitle(
        entry(38.2),
        t,
        () => '',
        () => '',
        (celsius, method) => `${celsius} ${method}`,
      ),
    ).toBe('38.2 axila')
  })
})
