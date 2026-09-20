// Which of the caregiver's babies is "active" (shown on the dashboard)
// when there's more than one - e.g. an older child plus a second
// pregnancy being tracked at the same time. Same localStorage pattern as
// i18n.ts's own stored preference: a plain per-browser value, not
// something worth a backend column for what's still a single-user
// convenience.
const STORAGE_KEY = 'pequedex_active_baby'

export function getStoredActiveBabyId(): number | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  const id = stored ? Number(stored) : NaN
  return Number.isInteger(id) ? id : null
}

export function storeActiveBabyId(id: number): void {
  localStorage.setItem(STORAGE_KEY, String(id))
}
