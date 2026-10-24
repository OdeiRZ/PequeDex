// Conversions between the API's UTC ISO strings and what an
// <input type="datetime-local"> expects/produces. Extracted out of
// DashboardView.vue (which had these inline) once ContractionsView.vue
// needed the exact same pair - this timezone handling has a documented
// bug history (see toUtcIso's own comment below), not something worth
// re-deriving per file.

// La hora local se lee campo a campo (getHours()...), nunca sumando el desfase
// horario a la fecha y leyéndola en UTC: esa suma se hacía en hora local y, la
// noche del cambio de hora, cruzaba las 3:00. Entre la 1:00 y las 3:00 de esa
// noche (desfase de verano, +2) sumar 120 minutos caía ya en el horario de
// invierno (+1), y el formulario mostraba una hora de más (la 1:30 como las
// 2:30). Visto en vivo la noche del 24 al 25 de octubre de 2026.
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function localParts(iso: string): string {
  const date = new Date(iso)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export function toLocalInputValue(iso: string): string {
  return localParts(iso).slice(0, 16)
}

// Same as toLocalInputValue, but keeping seconds (":ss") instead of
// truncating to whole minutes - for the one field where that precision
// actually matters, editing a contraction's start/end (many genuinely
// last under a minute). Pair with `step="1"` on the <input> itself, or
// the browser's native picker won't expose a seconds field even though
// the value has one.
export function toLocalInputValueWithSeconds(iso: string): string {
  return localParts(iso)
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
