// Conversions between the API's UTC ISO strings and what an
// <input type="datetime-local"> expects/produces. Extracted out of
// DashboardView.vue (which had these inline) once ContractionsView.vue
// needed the exact same pair - this timezone handling has a documented
// bug history (see toUtcIso's own comment below), not something worth
// re-deriving per file.

export function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function nowForInput(): string {
  return toLocalInputValue(new Date().toISOString())
}

// The inverse of toLocalInputValue, for the way back to the API: a
// <input type="datetime-local"> value has no timezone of its own - `new
// Date(...)` on a string like that is parsed as the *browser's* local
// time, exactly what was intended, so its own toISOString() is the
// correct UTC instant to send. Sending the naive value directly would
// have the backend (app.timezone=UTC) read "20:30" local as "20:30 UTC"
// instead, silently shifting every save by the browser's own offset -
// found while wiring up editing: saving a feed without touching its
// time still moved it by +2h in local dev (UTC+2), because create and
// edit both went straight through this same untranslated path.
export function toUtcIso(localValue: string): string {
  return new Date(localValue).toISOString()
}
