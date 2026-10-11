import type { Checkup, Region, Vaccination } from '@/stores/babies'
import { daysBetween, parseDateOnly } from '@/lib/localDate'

// Orden alfabético para el desplegable (las etiquetas visibles salen
// de i18n, `regions.<clave>`).
export const REGIONS: Region[] = [
  'andalucia',
  'aragon',
  'asturias',
  'baleares',
  'canarias',
  'cantabria',
  'castilla_la_mancha',
  'castilla_y_leon',
  'cataluna',
  'ceuta',
  'comunidad_valenciana',
  'extremadura',
  'galicia',
  'la_rioja',
  'madrid',
  'melilla',
  'murcia',
  'navarra',
  'pais_vasco',
]

export type VaccinationStatus = 'given' | 'optional' | 'overdue' | 'upcoming' | 'pending'

/** Días antes de la fecha prevista a partir de los cuales una vacuna o
 * revisión sale en la tarjeta "Próxima" del Dashboard. */
export const UPCOMING_DAYS = 7

export function vaccinationStatus(
  vaccination: Vaccination,
  now: Date = new Date(),
): VaccinationStatus {
  if (vaccination.given_at) return 'given'
  if (vaccination.optional) return 'optional'
  if (!vaccination.due_date) return 'pending'
  const days = daysBetween(now, parseDateOnly(vaccination.due_date))
  if (days < 0) return 'overdue'
  if (days <= UPCOMING_DAYS) return 'upcoming'
  return 'pending'
}

export type UpcomingItem =
  | { kind: 'vaccination'; date: Date; names: string[]; overdue: boolean }
  | { kind: 'checkup'; date: Date; reason: string | null }

/**
 * Lo más inmediato para la tarjeta del Dashboard: las vacunas sin poner
 * (no opcionales) atrasadas o previstas en los próximos `UPCOMING_DAYS`
 * días - agrupadas, porque varias caen el mismo día - o una revisión en
 * ese plazo, lo que llegue antes. `null` si no hay nada cerca.
 */
export function nextUpcoming(
  vaccinations: Vaccination[],
  checkups: Checkup[],
  now: Date = new Date(),
): UpcomingItem | null {
  const dueSoon = vaccinations.filter((v) => {
    const status = vaccinationStatus(v, now)
    return status === 'overdue' || status === 'upcoming'
  })

  let vaccinationItem: UpcomingItem | null = null
  if (dueSoon.length > 0) {
    const earliest = dueSoon.reduce((a, b) => ((a.due_date ?? '') <= (b.due_date ?? '') ? a : b))
    const sameDay = dueSoon.filter((v) => v.due_date === earliest.due_date)
    vaccinationItem = {
      kind: 'vaccination',
      date: parseDateOnly(earliest.due_date as string),
      names: sameDay.map((v) => v.name),
      overdue: vaccinationStatus(earliest, now) === 'overdue',
    }
  }

  const limit = new Date(now)
  limit.setDate(limit.getDate() + UPCOMING_DAYS)
  const checkup = checkups
    .filter((c) => {
      const at = new Date(c.scheduled_at)
      return at >= now && at <= limit
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  const checkupItem: UpcomingItem | null = checkup
    ? { kind: 'checkup', date: new Date(checkup.scheduled_at), reason: checkup.reason }
    : null

  if (vaccinationItem && checkupItem) {
    return vaccinationItem.date <= checkupItem.date ? vaccinationItem : checkupItem
  }
  return vaccinationItem ?? checkupItem
}

export interface VaccinationGroup {
  label: string
  items: Vaccination[]
}

/** Agrupadas por la edad del calendario ("2 meses", "3-4 años"...), en
 * el orden en que llegan (por fecha prevista); las añadidas a mano sin
 * edad van en su propio grupo, con la etiqueta que se pase. */
export function groupVaccinations(
  vaccinations: Vaccination[],
  customLabel: string,
): VaccinationGroup[] {
  const groups: VaccinationGroup[] = []
  for (const vaccination of vaccinations) {
    const label = vaccination.age_label ?? customLabel
    const group = groups.find((g) => g.label === label)
    if (group) {
      group.items.push(vaccination)
    } else {
      groups.push({ label, items: [vaccination] })
    }
  }
  return groups
}
