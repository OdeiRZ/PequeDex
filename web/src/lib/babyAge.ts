// birth_date/due_date are date-only ("YYYY-MM-DD"), no time-of-day
// meaning - parsed as a local calendar date, not via `new Date(iso)`
// directly, which treats a bare date string as UTC midnight and can
// shift the displayed day by one depending on the browser's timezone.
export function parseDateOnly(value: string): Date {
  const parts = value.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function daysBetween(from: Date, to: Date): number {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((utcTo - utcFrom) / 86_400_000)
}

// The calendar date the baby turns exactly one month old - same
// day-of-month next month, not a flat "30 days" proxy (a baby born on
// the 31st turning "one month" lands on the last day of February some
// years, same rollover `Date` already does for a human birthday).
function oneMonthAfter(date: Date): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  return result
}

export type BabyAgeInfo =
  | { type: 'born'; days: number; weeks: number; underOneMonth: boolean }
  | { type: 'expecting'; daysUntilDue: number }
  | { type: 'unknown' }

// Days for a newborn under one month old (the number that actually
// matters then - "day by day" is how parents actually track it, same
// as real parenting apps), weeks once a full month has passed.
// Expecting (due_date set, no birth_date yet) gets a countdown instead;
// neither date set is a real, common state (onboarding lets both be
// skipped) and just renders as "unknown".
export function getBabyAge(
  birthDate: string | null,
  dueDate: string | null,
  now: Date = new Date(),
): BabyAgeInfo {
  if (birthDate) {
    const birth = parseDateOnly(birthDate)
    const days = daysBetween(birth, now)
    // A `birth_date` in the future isn't really a birth yet - a date
    // picked ahead of time, or a due date entered into the wrong field.
    // Without this, it clamped to `days: 0` and read as "born today",
    // which unlocked feed/sleep/timeline tracking for a baby that
    // hasn't actually arrived.
    if (days >= 0) {
      return {
        type: 'born',
        days,
        weeks: Math.floor(days / 7),
        underOneMonth: now < oneMonthAfter(birth),
      }
    }
    return { type: 'expecting', daysUntilDue: -days }
  }

  if (dueDate) {
    return {
      type: 'expecting',
      daysUntilDue: Math.max(0, daysBetween(now, parseDateOnly(dueDate))),
    }
  }

  return { type: 'unknown' }
}
