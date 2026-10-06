import { describe, it, expect } from 'vitest'
import { getBabyAge } from '@/lib/babyAge'

describe('getBabyAge', () => {
  it('reports days for a baby born this week', () => {
    const now = new Date(2026, 7, 10)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({
      type: 'born',
      days: 3,
      weeks: 0,
      underOneMonth: true,
    })
  })

  it('is still under one month at 29 days, when the birth month has 31 days', () => {
    const now = new Date(2026, 8, 5)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({
      type: 'born',
      days: 29,
      weeks: 4,
      underOneMonth: true,
    })
  })

  it('treats the birth date itself as day 0, not day -1 or 1', () => {
    const now = new Date(2026, 7, 7)
    expect(getBabyAge('2026-08-07', null, now)).toEqual({
      type: 'born',
      days: 0,
      weeks: 0,
      underOneMonth: true,
    })
  })

  it('turns one month old on the same day-of-month next month, not a flat 30 days', () => {
    // Born 7 Aug -> turns one month on 7 Sep. One day before: still
    // under a month (day-by-day); that exact day: a full month has
    // passed (switches to weeks).
    const dayBefore = getBabyAge('2026-08-07', null, new Date(2026, 8, 6))
    const exactlyOneMonth = getBabyAge('2026-08-07', null, new Date(2026, 8, 7))
    if (dayBefore.type !== 'born' || exactlyOneMonth.type !== 'born') throw new Error('unreachable')

    expect(dayBefore.underOneMonth).toBe(true)
    expect(exactlyOneMonth.underOneMonth).toBe(false)
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
    expect(getBabyAge('2026-09-07', '2026-09-01', now)).toEqual({
      type: 'born',
      days: 3,
      weeks: 0,
      underOneMonth: true,
    })
  })

  it('treats a birth_date that has not arrived yet as expecting, not born', () => {
    // A birth_date picked ahead of time (or a due date entered into the
    // wrong field) shouldn't read as "born today" - there's nothing to
    // track yet.
    const now = new Date(2026, 7, 1)
    expect(getBabyAge('2026-08-15', null, now)).toEqual({ type: 'expecting', daysUntilDue: 14 })
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
