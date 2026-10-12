import { describe, expect, it } from 'vitest'
import { formatPredictionRange } from '@/lib/predictionRange'

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
