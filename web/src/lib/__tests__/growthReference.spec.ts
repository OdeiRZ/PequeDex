import { describe, it, expect } from 'vitest'
import { referenceSamples, type GrowthReferenceRow } from '@/lib/growthReference'

// Tres meses de curva lineal fácil de comprobar a mano.
const rows: GrowthReferenceRow[] = [0, 1, 2].map((month) => ({
  month,
  p3: 10 + month,
  p15: 20 + month,
  p50: 30 + month,
  p85: 40 + month,
  p97: 50 + month,
}))

const MONTH_MS = 30.4375 * 86_400_000
const birth = new Date(2026, 0, 1).getTime()

describe('referenceSamples', () => {
  it('is empty without curves or birth date', () => {
    expect(referenceSamples(null, '2026-01-01', birth, birth + MONTH_MS)).toEqual([])
    expect(referenceSamples(rows, null, birth, birth + MONTH_MS)).toEqual([])
  })

  it('interpolates both ends and includes every whole month in between', () => {
    const samples = referenceSamples(
      rows,
      '2026-01-01',
      birth + 0.5 * MONTH_MS,
      birth + 1.5 * MONTH_MS,
    )
    expect(samples.map((s) => s.p50)).toEqual([30.5, 31, 31.5])
    expect(samples[0]?.at).toBeCloseTo(birth + 0.5 * MONTH_MS)
  })

  it('clips to the months the table covers', () => {
    const samples = referenceSamples(rows, '2026-01-01', birth - MONTH_MS, birth + 5 * MONTH_MS)
    expect(samples[0]?.p3).toBe(10)
    expect(samples[samples.length - 1]?.p97).toBe(52)
  })

  it('is empty when the range falls entirely outside the table', () => {
    expect(
      referenceSamples(rows, '2026-01-01', birth + 3 * MONTH_MS, birth + 4 * MONTH_MS),
    ).toEqual([])
  })
})
