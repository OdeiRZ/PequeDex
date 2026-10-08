// Plain "YYYY-MM-DD" helpers for the "Ritmo" day navigator - the whole
// point is browsing calendar days as the user perceives them locally
// (the same local-midnight boundary DailyRhythm.vue already uses for
// "today"), so these stay in local time throughout, never touching
// `toISOString()` directly (that's UTC, and would drift the shown day
// by one near midnight depending on the browser's timezone).
import { daysBetween, parseDateOnly } from './babyAge'

export { daysBetween, parseDateOnly }

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateOnlyString(): string {
  return toDateOnlyString(new Date())
}

export function addDays(dateOnly: string, delta: number): string {
  const date = parseDateOnly(dateOnly)
  date.setDate(date.getDate() + delta)
  return toDateOnlyString(date)
}

// "Martes 5 de octubre" - el nombre del día entra delante de todo, no
// detrás como un dato suelto. `Intl` en es-ES devuelve el día de la
// semana en minúscula y con una coma ("martes, 5 de octubre"); se
// quita la coma y se capitaliza en vez de montar la cadena a mano
// campo a campo, para que el mismo código sirva igual con el inglés
// (que ya llega capitalizado). Compartido entre "Ritmo"
// (`DailyRhythm.vue`) y "Línea temporal" (`DashboardView.vue`).
export function formatWeekdayDateLabel(date: Date, locale?: string): string {
  const raw = date
    .toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
