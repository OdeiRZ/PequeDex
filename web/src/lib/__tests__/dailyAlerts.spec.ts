import { describe, it, expect } from 'vitest'
import { computeDailyAlerts } from '@/lib/dailyAlerts'
import type { DiaperChange } from '@/stores/babies'

let nextId = 1
function change(type: DiaperChange['type'], at: Date): DiaperChange {
  return {
    id: nextId++,
    baby_id: 1,
    user_id: 1,
    changed_at: at.toISOString(),
    type,
    residue_color: null,
    size: null,
    notes: null,
  }
}

// Domingo 11/10/2026 a las 20:00 locales.
const now = new Date(2026, 9, 11, 20, 0)
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000)
const birth = '2026-08-01'

describe('computeDailyAlerts - no poop', () => {
  it('warns after 3 days without a dirty diaper while diapers are being logged', () => {
    const alerts = computeDailyAlerts(
      [change('sucio', hoursAgo(80)), change('mojado', hoursAgo(5))],
      birth,
      now,
    )
    expect(alerts).toContainEqual({ key: 'noPoop', days: 3, atLeast: false })
  })

  it('stays quiet under 3 days', () => {
    const alerts = computeDailyAlerts(
      [change('ambos', hoursAgo(60)), change('mojado', hoursAgo(5))],
      birth,
      now,
    )
    expect(alerts.find((a) => a.key === 'noPoop')).toBeUndefined()
  })

  it('stays quiet when nothing has been logged in the last 48 h', () => {
    const alerts = computeDailyAlerts([change('mojado', hoursAgo(100))], birth, now)
    expect(alerts).toEqual([])
  })

  it('says "at least" when there is no poop in the whole window', () => {
    const alerts = computeDailyAlerts(
      [change('mojado', hoursAgo(5 * 24)), change('mojado', hoursAgo(3))],
      birth,
      now,
    )
    expect(alerts).toContainEqual({ key: 'noPoop', days: 5, atLeast: true })
  })
})

describe('computeDailyAlerts - few wet diapers today', () => {
  // 4 cambios al día los 3 días anteriores, todos con caca y pis.
  const consistentHistory = [1, 2, 3].flatMap((daysBack) =>
    [8, 12, 16, 20].map((hour) => {
      const at = new Date(now)
      at.setDate(at.getDate() - daysBack)
      at.setHours(hour, 0, 0, 0)
      return change('ambos', at)
    }),
  )

  it('warns from 18:00 with fewer than 4 wet diapers today', () => {
    const alerts = computeDailyAlerts(
      [...consistentHistory, change('mojado', hoursAgo(3)), change('sucio', hoursAgo(2))],
      birth,
      now,
    )
    expect(alerts).toContainEqual({ key: 'fewWet', count: 1 })
  })

  it('stays quiet before 18:00', () => {
    const morning = new Date(2026, 9, 11, 12, 0)
    const alerts = computeDailyAlerts(consistentHistory, birth, morning)
    expect(alerts.find((a) => a.key === 'fewWet')).toBeUndefined()
  })

  it('stays quiet when the previous days were not fully logged', () => {
    const alerts = computeDailyAlerts([change('mojado', hoursAgo(3))], birth, now)
    expect(alerts.find((a) => a.key === 'fewWet')).toBeUndefined()
  })

  it('stays quiet in the first days of life', () => {
    const alerts = computeDailyAlerts(consistentHistory, '2026-10-08', now)
    expect(alerts.find((a) => a.key === 'fewWet')).toBeUndefined()
  })

  it('stays quiet with 4 or more wet diapers today', () => {
    const today = [1, 3, 5, 7].map((h) => change('mojado', hoursAgo(h)))
    const alerts = computeDailyAlerts([...consistentHistory, ...today], birth, now)
    expect(alerts.find((a) => a.key === 'fewWet')).toBeUndefined()
  })
})
