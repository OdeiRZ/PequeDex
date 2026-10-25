import { i18n } from '@/i18n'

// Cifras para mostrar, en el idioma de la app: coma decimal en español ("3,9"),
// punto en inglés, y siempre un espacio antes de la unidad ("3,9 h", "1 h 5
// min"). Antes cada pantalla montaba las suyas a mano ("3.9h", "10min"). Solo
// para leer: los campos de formulario (la temperatura que se escribe) necesitan
// el punto y no pasan por aquí.

function numberLocale(): string {
  return i18n.global.locale.value === 'en' ? 'en-GB' : 'es-ES'
}

/** "11,7" / "11.7": un número con `digits` decimales fijos. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString(numberLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  })
}

/** "3,9 h", "4 h": horas con un decimal como mucho (sin ",0"). */
export function formatHoursShort(hours: number): string {
  const value = hours.toLocaleString(numberLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    useGrouping: false,
  })
  return `${value} h`
}

/** "45 min", "2 h", "1 h 5 min": una duración en minutos, redondeada. */
export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
