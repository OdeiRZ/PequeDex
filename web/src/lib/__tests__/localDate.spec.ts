import { describe, it, expect } from 'vitest'
import { toDateOnlyString, addDays, parseDateOnly } from '@/lib/localDate'

describe('toDateOnlyString', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateOnlyString(new Date(2026, 8, 5))).toBe('2026-09-05')
  })

  it('pads single-digit months and days', () => {
    expect(toDateOnlyString(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('addDays', () => {
  it('adds a day, staying within the same month', () => {
    expect(addDays('2026-09-05', 1)).toBe('2026-09-06')
  })

  it('subtracts a day, staying within the same month', () => {
    expect(addDays('2026-09-05', -1)).toBe('2026-09-04')
  })

  it('rolls over into the next month', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('rolls back into the previous month', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('rolls over into the next year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('round-trips through parseDateOnly without a timezone shift', () => {
    const parsed = parseDateOnly('2026-09-05')
    expect(toDateOnlyString(parsed)).toBe('2026-09-05')
  })
})
