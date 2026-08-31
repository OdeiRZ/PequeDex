// birth_date/due_date are date-only ("YYYY-MM-DD"), no time-of-day
// meaning - parsed as a local calendar date, not via `new Date(iso)`
// directly, which treats a bare date string as UTC midnight and can
// shift the displayed day by one depending on the browser's timezone.
function parseDateOnly(value: string): Date {
  const parts = value.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function daysBetween(from: Date, to: Date): number {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((utcTo - utcFrom) / 86_400_000)
}

export type BabyAgeInfo =
  | { type: 'born'; days: number; weeks: number }
  | { type: 'expecting'; daysUntilDue: number }
  | { type: 'unknown' }

// Days for a newborn (the number that actually matters in the first two
// weeks), weeks once there's more than one to count - same threshold
// real parenting apps use. Expecting (due_date set, no birth_date yet)
// gets a countdown instead; neither date set is a real, common state
// (onboarding lets both be skipped) and just renders as "unknown".
export function getBabyAge(
  birthDate: string | null,
  dueDate: string | null,
  now: Date = new Date(),
): BabyAgeInfo {
  if (birthDate) {
    const days = Math.max(0, daysBetween(parseDateOnly(birthDate), now))
    return { type: 'born', days, weeks: Math.floor(days / 7) }
  }

  if (dueDate) {
    return {
      type: 'expecting',
      daysUntilDue: Math.max(0, daysBetween(now, parseDateOnly(dueDate))),
    }
  }

  return { type: 'unknown' }
}
