import { describe, it, expect } from 'vitest'
import { getBabyAge } from '@/lib/babyAge'

describe('getBabyAge', () => {
  it('reports days for a baby born this week', () => {
    const now = new Date(2026, 7, 10)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({ type: 'born', days: 3, weeks: 0 })
  })

  it('reports weeks once there is more than one full week', () => {
    const now = new Date(2026, 8, 5)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({ type: 'born', days: 29, weeks: 4 })
  })

  it('treats the birth date itself as day 0, not day -1 or 1', () => {
    const now = new Date(2026, 7, 7)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({ type: 'born', days: 0, weeks: 0 })
  })

  it('counts down to the due date when there is no birth date yet', () => {
    const now = new Date(2026, 7, 1)
    expect(getBabyAge(null, '2026-09-07', now)).toEqual({ type: 'expecting', daysUntilDue: 37 })
  })

  it('clamps an overdue countdown to zero instead of going negative', () => {
    const now = new Date(2026, 8, 10)
    expect(getBabyAge(null, '2026-09-07', now)).toEqual({ type: 'expecting', daysUntilDue: 0 })
  })

  it('prefers birth_date over due_date when both are set', () => {
    const now = new Date(2026, 8, 10)
    expect(getBabyAge('2026-09-07', '2026-09-01', now)).toEqual({ type: 'born', days: 3, weeks: 0 })
  })

  it('is unknown when neither date is set', () => {
    expect(getBabyAge(null, null)).toEqual({ type: 'unknown' })
  })

  it('is not thrown off by the browser timezone, unlike parsing the date string directly', () => {
    // A naive `new Date('2026-08-07')` is midnight UTC - in a
    // negative-offset timezone that's still 2026-08-06 locally, which
    // would make "now" look like it's *before* the birth date.
    const now = new Date(2026, 7, 7, 0, 30)
    expect(getBabyAge('2026-08-07', null, now).type).toBe('born')
  })
})
