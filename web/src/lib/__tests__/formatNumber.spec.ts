import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import { formatDecimal, formatDurationMinutes, formatHoursShort } from '../formatNumber'

describe('formatNumber', () => {
  afterEach(() => {
    i18n.global.locale.value = 'es'
  })

  it('uses a decimal comma and a space before the unit in Spanish', () => {
    i18n.global.locale.value = 'es'
    expect(formatDecimal(11.7)).toBe('11,7')
    expect(formatDecimal(13)).toBe('13,0')
    expect(formatHoursShort(3.9)).toBe('3,9 h')
    expect(formatHoursShort(4)).toBe('4 h')
  })

  it('keeps the decimal point in English', () => {
    i18n.global.locale.value = 'en'
    expect(formatDecimal(11.7)).toBe('11.7')
    expect(formatHoursShort(3.9)).toBe('3.9 h')
  })

  it('writes durations with spaces, rounding to the minute', () => {
    expect(formatDurationMinutes(45)).toBe('45 min')
    expect(formatDurationMinutes(120)).toBe('2 h')
    expect(formatDurationMinutes(65.4)).toBe('1 h 5 min')
    expect(formatDurationMinutes(-3)).toBe('0 min')
  })

  it('never groups thousands in short figures', () => {
    expect(formatDecimal(1234.5)).toBe('1234,5')
  })
})
