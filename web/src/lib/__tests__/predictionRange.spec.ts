import { describe, expect, it } from 'vitest'
import {
  OVERDUE_GRACE_MS,
  formatPredictionAt,
  formatPredictionRange,
  isPredictionOverdue,
} from '@/lib/predictionRange'

describe('formatPredictionAt', () => {
  it('shows date and hours:minutes, without seconds', () => {
    const formatted = formatPredictionAt('2026-10-12T15:10:00', 'es-ES')

    expect(formatted).toMatch(/12\/10\/2026/)
    expect(formatted).toMatch(/15:10/)
    // Ni ":00" de los segundos: tras la hora y los minutos no sigue nada.
    expect(formatted).not.toMatch(/15:10:\d\d/)
  })

  it('works in English too', () => {
    expect(formatPredictionAt('2026-10-12T15:10:00', 'en-US')).not.toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })
})

describe('formatPredictionRange', () => {
  it('returns null without a range', () => {
    expect(formatPredictionRange(null, 'es-ES')).toBeNull()
    expect(formatPredictionRange(undefined, 'es-ES')).toBeNull()
  })

  it('formats both ends as times, in order', () => {
    const range = { from: '2026-10-12T12:10:00Z', to: '2026-10-12T13:20:00Z' }
    const formatted = formatPredictionRange(range, 'es-ES')

    expect(formatted).not.toBeNull()
    expect(formatted!.from).toMatch(/\d{1,2}:\d{2}/)
    expect(formatted!.to).toMatch(/\d{1,2}:\d{2}/)
    expect(formatted!.from).not.toBe(formatted!.to)
  })

  it('puts the earlier time first even if the server swapped them', () => {
    const swapped = formatPredictionRange(
      { from: '2026-10-12T13:20:00Z', to: '2026-10-12T12:10:00Z' },
      'es-ES',
    )
    const ordered = formatPredictionRange(
      { from: '2026-10-12T12:10:00Z', to: '2026-10-12T13:20:00Z' },
      'es-ES',
    )

    expect(swapped).toEqual(ordered)
  })

  it('ignores an invalid date', () => {
    expect(formatPredictionRange({ from: 'x', to: '2026-10-12T12:10:00Z' }, 'es-ES')).toBeNull()
  })
})

describe('isPredictionOverdue', () => {
  // El caso real: despertó a las 22:50 (hora de Madrid), la estimación de la
  // siguiente siesta era las 23:35 con un rango habitual de 23:12 a 00:23, y a la
  // 01:47 seguía despierto sin nada nuevo registrado.
  const prediction = {
    at: '2026-10-13T21:35:00Z', // 23:35 Madrid
    range: { from: '2026-10-13T21:12:00Z', to: '2026-10-13T22:23:00Z' }, // 23:12 - 00:23
  }

  it('is overdue at 01:47, hours after the usual range ended (the reported case)', () => {
    expect(isPredictionOverdue(prediction, new Date('2026-10-13T23:47:00Z'))).toBe(true)
  })

  it('is not overdue before the estimated time', () => {
    expect(isPredictionOverdue(prediction, new Date('2026-10-13T20:00:00Z'))).toBe(false)
  })

  it('is not overdue just after the exact time while still inside the usual range', () => {
    // 23:40: la hora puntual (23:35) ya pasó, pero "suele ser hasta las 00:23" sigue valiendo.
    expect(isPredictionOverdue(prediction, new Date('2026-10-13T21:40:00Z'))).toBe(false)
  })

  it('becomes overdue only once the usual range has ended', () => {
    expect(isPredictionOverdue(prediction, new Date('2026-10-13T22:23:00Z'))).toBe(false)
    expect(isPredictionOverdue(prediction, new Date('2026-10-13T22:23:01Z'))).toBe(true)
  })

  it('without a usual range, tolerates 30 minutes past the exact time', () => {
    const noRange = { at: '2026-10-13T21:35:00Z', range: null }
    const at = new Date(noRange.at).getTime()

    expect(isPredictionOverdue(noRange, new Date(at + OVERDUE_GRACE_MS))).toBe(false)
    expect(isPredictionOverdue(noRange, new Date(at + OVERDUE_GRACE_MS + 1000))).toBe(true)
    expect(isPredictionOverdue({ at: noRange.at }, new Date(at + 3 * 3_600_000))).toBe(true)
  })

  it('never ends before the exact time, even if the server gave a range that stops short of it', () => {
    const shortRange = {
      at: '2026-10-13T21:35:00Z',
      range: { from: '2026-10-13T21:00:00Z', to: '2026-10-13T21:20:00Z' },
    }

    expect(isPredictionOverdue(shortRange, new Date('2026-10-13T21:30:00Z'))).toBe(false)
    expect(isPredictionOverdue(shortRange, new Date('2026-10-13T21:36:00Z'))).toBe(true)
  })

  it('treats an unreadable estimate as not overdue instead of hiding the prediction', () => {
    expect(isPredictionOverdue({ at: 'no es una fecha' }, new Date())).toBe(false)
  })

  it('falls back to the exact time plus the grace when the range is unreadable', () => {
    const garbledRange = { at: '2026-10-13T21:35:00Z', range: { from: 'x', to: 'y' } }

    expect(isPredictionOverdue(garbledRange, new Date('2026-10-13T21:40:00Z'))).toBe(false)
    expect(isPredictionOverdue(garbledRange, new Date('2026-10-13T22:10:00Z'))).toBe(true)
  })
})
