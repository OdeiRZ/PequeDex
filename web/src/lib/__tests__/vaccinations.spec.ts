import { describe, it, expect } from 'vitest'
import { groupVaccinations, nextUpcoming, vaccinationStatus } from '@/lib/vaccinations'
import { summarizeVaccinationStats } from '@/lib/stats'
import type { Checkup, Vaccination } from '@/stores/babies'

let id = 1
function vaccination(overrides: Partial<Vaccination> = {}): Vaccination {
  return {
    id: id++,
    baby_id: 1,
    user_id: null,
    code: null,
    name: 'Hexavalente',
    age_label: '2 meses',
    due_date: '2026-10-15',
    given_at: null,
    optional: false,
    notes: null,
    ...overrides,
  }
}

function checkup(at: string, reason = 'Revisión'): Checkup {
  return { id: id++, baby_id: 1, user_id: 1, scheduled_at: at, reason, notes: null }
}

const now = new Date(2026, 9, 12, 10, 0)

describe('vaccinationStatus', () => {
  it('reads given, optional, overdue, upcoming and pending', () => {
    expect(vaccinationStatus(vaccination({ given_at: '2026-10-01' }), now)).toBe('given')
    expect(vaccinationStatus(vaccination({ optional: true }), now)).toBe('optional')
    expect(vaccinationStatus(vaccination({ due_date: '2026-10-11' }), now)).toBe('overdue')
    expect(vaccinationStatus(vaccination({ due_date: '2026-10-19' }), now)).toBe('upcoming')
    expect(vaccinationStatus(vaccination({ due_date: '2026-10-20' }), now)).toBe('pending')
    expect(vaccinationStatus(vaccination({ due_date: null }), now)).toBe('pending')
  })
})

describe('nextUpcoming', () => {
  it('groups the vaccines due on the same nearest day', () => {
    const item = nextUpcoming(
      [
        vaccination({ name: 'Hexavalente', due_date: '2026-10-15' }),
        vaccination({ name: 'Neumococo', due_date: '2026-10-15' }),
        vaccination({ name: 'Varicela', due_date: '2026-10-18' }),
      ],
      [],
      now,
    )
    expect(item).toMatchObject({
      kind: 'vaccination',
      names: ['Hexavalente', 'Neumococo'],
      overdue: false,
    })
  })

  it('ignores optional and given vaccines and anything beyond 7 days', () => {
    expect(
      nextUpcoming(
        [
          vaccination({ optional: true, due_date: '2026-10-13' }),
          vaccination({ given_at: '2026-10-12', due_date: '2026-10-13' }),
          vaccination({ due_date: '2026-11-30' }),
        ],
        [],
        now,
      ),
    ).toBeNull()
  })

  it('picks a checkup when it comes before the next vaccine', () => {
    const item = nextUpcoming(
      [vaccination({ due_date: '2026-10-18' })],
      [checkup(new Date(2026, 9, 14, 9, 30).toISOString(), 'Revisión 2 meses')],
      now,
    )
    expect(item).toMatchObject({ kind: 'checkup', reason: 'Revisión 2 meses' })
  })

  it('flags an overdue vaccine first', () => {
    const item = nextUpcoming([vaccination({ due_date: '2026-10-05' })], [], now)
    expect(item).toMatchObject({ kind: 'vaccination', overdue: true })
  })
})

describe('summarizeVaccinationStats', () => {
  it('counts given, required and overdue, and lists given and the next 5 pending', () => {
    const stats = summarizeVaccinationStats(
      [
        vaccination({ name: 'A', given_at: '2026-10-02' }),
        vaccination({ name: 'B', due_date: '2026-10-01' }), // atrasada
        vaccination({ name: 'Opcional', optional: true }),
        ...['C', 'D', 'E', 'F', 'G'].map((name) => vaccination({ name, due_date: '2026-12-01' })),
      ],
      [checkup(new Date(2026, 9, 20, 9).toISOString(), 'Revisión 4 meses')],
      now,
    )
    expect(stats.given).toBe(1)
    expect(stats.total).toBe(7)
    expect(stats.overdue).toBe(1)
    expect(stats.givenList).toEqual([{ name: 'A', date: '2026-10-02' }])
    expect(stats.upcomingList.map((v) => v.name)).toEqual(['B', 'C', 'D', 'E', 'F'])
    expect(stats.nextCheckup?.reason).toBe('Revisión 4 meses')
  })
})

describe('groupVaccinations', () => {
  it('groups by age label, custom ones under their own label', () => {
    const groups = groupVaccinations(
      [
        vaccination({ age_label: '2 meses' }),
        vaccination({ age_label: '2 meses' }),
        vaccination({ age_label: '4 meses' }),
        vaccination({ age_label: null }),
      ],
      'Añadidas',
    )
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['2 meses', 2],
      ['4 meses', 1],
      ['Añadidas', 1],
    ])
  })
})
