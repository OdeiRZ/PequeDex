import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nowForInput,
  toLocalInputValue,
  toLocalInputValueWithSeconds,
  toUtcIso,
} from '../datetimeInput'

// La zona de España, con su cambio de hora: Node relee `TZ` al cambiarla.
const originalTz = process.env.TZ

describe('datetimeInput (Europe/Madrid)', () => {
  beforeEach(() => {
    process.env.TZ = 'Europe/Madrid'
  })

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  it('shows the real local time on the night the clocks go back, before the change', () => {
    // 1:30 en España (horario de verano, UTC+2) la noche del 24 al 25 de octubre
    // de 2026; a las 3:00 vuelve a ser las 2:00. Antes salía "02:30".
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T23:30:00Z'))

    expect(nowForInput()).toBe('2026-10-25T01:30')
  })

  it('shows the repeated hour correctly after the clocks go back', () => {
    expect(toLocalInputValue('2026-10-25T00:30:00Z')).toBe('2026-10-25T02:30') // verano
    expect(toLocalInputValue('2026-10-25T01:30:00Z')).toBe('2026-10-25T02:30') // invierno
  })

  it('handles the night the clocks go forward', () => {
    expect(toLocalInputValue('2026-03-29T00:30:00Z')).toBe('2026-03-29T01:30')
    expect(toLocalInputValue('2026-03-29T01:30:00Z')).toBe('2026-03-29T03:30')
  })

  it('keeps the seconds when asked and round-trips through toUtcIso', () => {
    expect(toLocalInputValueWithSeconds('2026-07-01T10:15:42Z')).toBe('2026-07-01T12:15:42')
    expect(toUtcIso(toLocalInputValue('2026-07-01T10:15:00Z'))).toBe('2026-07-01T10:15:00.000Z')
  })
})
