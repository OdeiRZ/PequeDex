// Funciones puras para presentar una entrada de la línea temporal
// (`DashboardView.vue`), extraídas de ese fichero para poder testearlas
// sin montar el componente entero - DashboardView.vue es, con
// diferencia, la vista más grande de la app y no tenía ni un test
// unitario pese a concentrar bastante lógica real (qué icono/color
// mostrar, cuándo hay badge de duración, etc.). Nada aquí depende de
// Vue ni de Pinia; el componente sigue siendo el único sitio que las
// llama, pasándoles sus propios refs/computeds donde hace falta (hora
// local, traducciones).
import type { TimelineEntry } from '@/stores/babies'
import type { Category } from '@/lib/category'
import { DIAPER_PEE_COLOR, DIAPER_RESIDUE_COLOR_HEX } from '@/lib/diaperResidueColor'
import { MILK_TYPE_DROPLET_FILL } from '@/lib/milkType'
import { parseDateOnly } from '@/lib/localDate'

/** Firma de `t()` de vue-i18n - se pasa tal cual desde el componente,
 * sin ninguna capa de adaptación, para poder mockearla en los tests sin
 * montar i18n de verdad. */
export type Translate = (key: string, params?: Record<string, unknown>) => string

export function entryCategory(entry: TimelineEntry): Category {
  return entry.type === 'diaper_change' ? 'diaper' : entry.type
}

// Un cuidador reconoce un pañal por sus iconos, no leyendo su nombre
// (mismo criterio que los selectores de tipo/color de "+ Pañal", que
// estas dos funciones reflejan exactamente): una gota de pis para
// "mojado"/"ambos", un remolino de caca para "sucio"/"ambos" - uno
// "ambos" lleva los dos a la vez. `undefined` (no se pinta nada) para
// cualquier cosa que no sea un cambio de pañal, o el icono que ese tipo
// concreto no pide.
export function entryPeeDroplet(entry: TimelineEntry): string | undefined {
  if (entry.type !== 'diaper_change') return undefined
  return entry.data.type === 'mojado' || entry.data.type === 'ambos' ? DIAPER_PEE_COLOR : undefined
}

// Cae a marrón cuando no se indicó color, mismo motivo que
// `entryMilkDroplet`'s propio fallback a `leche` más abajo - un hueco
// inconsistente (caca coloreada en unas filas, sin color en otras) se
// lee más confuso que un color por defecto razonable en todas.
export function entryPoopColor(entry: TimelineEntry): string | undefined {
  if (entry.type !== 'diaper_change') return undefined
  if (entry.data.type !== 'sucio' && entry.data.type !== 'ambos') return undefined
  return DIAPER_RESIDUE_COLOR_HEX[entry.data.residue_color || 'marron']
}

// 💤 junto a una fila de sueño, mismo criterio de "reconocer de un
// vistazo" que los iconos de pañal/toma de arriba - pero un emoji
// plano aquí, no un SVG coloreado, porque no hay ningún color que
// comunicar.
export function entrySleepEmoji(entry: TimelineEntry): string | undefined {
  return entry.type === 'sleep' ? '💤' : undefined
}

export function entrySleepPulsing(entry: TimelineEntry): boolean {
  return entry.type === 'sleep' && entry.data.ended_at === null
}

export function formatDuration(
  startedAt: string,
  endedAt: string | null,
  now: () => number = Date.now,
): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : now()
  const minutes = Math.max(0, Math.round((end - start) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return hours > 0 ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`
}

export function formatTime(at: string, locale?: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// Misma condición exacta que entryDuration() de abajo (su badge) - la
// marca de tiempo trasera solo pasa a dos líneas (fin arriba, inicio
// abajo) cuando ya hay un ended_at real que mostrar; mientras no lo
// haya (sueño en curso, toma sin duración cargada), sigue siendo la
// única hora de siempre.
export function entryEndTime(entry: TimelineEntry, locale?: string): string | undefined {
  if (entry.type === 'sleep' && entry.data.ended_at) {
    return formatTime(entry.data.ended_at, locale)
  }
  if (entry.type === 'feed' && entry.data.type === 'pecho' && entry.data.ended_at) {
    return formatTime(entry.data.ended_at, locale)
  }
  return undefined
}

// Duración como badge a la derecha de la fila - la línea temporal solo
// mostraba la hora de inicio, sin ninguna pista de cuánto duró sin abrir
// la entrada a editarla. Un sueño EN CURSO no lleva badge, a propósito -
// esa fila ya lleva su propio botón "Finalizar", y un contador en vivo
// al lado era ruido de más, no información extra: el badge solo
// aparece una vez el sueño tiene ended_at de verdad. Una toma, a
// diferencia del sueño, no tiene ningún concepto de "en curso" - sin
// ended_at (no se indicó duración, o es biberón/sólido, que no la
// llevan) simplemente no hay badge.
export function entryDuration(entry: TimelineEntry, now?: () => number): string | undefined {
  if (entry.type === 'sleep' && entry.data.ended_at) {
    return formatDuration(entry.data.started_at, entry.data.ended_at, now)
  }
  if (entry.type === 'feed' && entry.data.type === 'pecho' && entry.data.ended_at) {
    return formatDuration(entry.data.started_at, entry.data.ended_at, now)
  }
  return undefined
}

// Mismo hueco de badge que la duración de arriba, pero para un pañal -
// que no tiene concepto de duración, así que entryDuration() siempre
// devuelve undefined para él. Solo cuando la talla se indicó al
// guardar (es opcional); sin ella, la fila se queda con solo los
// iconos de tipo.
export function entryDiaperSizeLabel(entry: TimelineEntry, t: Translate): string | undefined {
  if (entry.type !== 'diaper_change' || !entry.data.size) return undefined
  return t('dashboard.diaperForm.sizeBadge', { size: entry.data.size })
}

// Misma idea aplicada a la leche de una toma - una gota coloreada como
// la de verdad junto al título de la fila. Un biberón también lleva
// leche (fórmula o extraída, las dos se leen como blanco - `milk_type`
// solo se guarda nunca para una toma de pecho, así que un biberón no
// tiene campo que leer y toma directamente el color de `leche`). Una
// toma de pecho registrada antes de que existiera este campo tiene
// `milk_type: null` para siempre (nada rellena las filas antiguas) -
// cae también a `leche`, mismo criterio que un biberón y que lo que ya
// usa por defecto el formulario de "+ Toma". Solo un sólido - nada de
// leche - no pinta ninguna gota.
export function entryMilkDroplet(entry: TimelineEntry): string | undefined {
  if (entry.type !== 'feed') return undefined
  if (entry.data.type === 'biberon') return MILK_TYPE_DROPLET_FILL.leche
  if (entry.data.type === 'pecho') return MILK_TYPE_DROPLET_FILL[entry.data.milk_type ?? 'leche']
  return undefined
}

export function entryTitle(
  entry: TimelineEntry,
  t: Translate,
  sideLabel: (side: string | null) => string,
  diaperTypeLabel: (type: string) => string,
): string {
  if (entry.type === 'feed') {
    if (entry.data.type === 'biberon') {
      return t('dashboard.timeline.bottleSummary', { amount: entry.data.amount_ml })
    }
    if (entry.data.type === 'pecho') {
      return t('dashboard.timeline.breastSummary', { side: sideLabel(entry.data.side) })
    }
    return t('dashboard.timeline.solidSummary')
  }

  if (entry.type === 'sleep') {
    return entry.data.ended_at
      ? t('dashboard.timeline.sleepDone')
      : t('dashboard.timeline.sleepOngoing')
  }

  return t('dashboard.timeline.diaperSummary', { type: diaperTypeLabel(entry.data.type) })
}

// `babies.dayTimeline` (un día pasado de "Ritmo"/"Línea temporal") es
// deliberadamente más ancho que el día local exacto - empieza un día
// antes para no cortar un sueño que cruza medianoche, calculado contra
// límites UTC en el backend, no los del navegador. En cualquier zona
// horaria por delante de UTC (Europe/Madrid, UTC+1/+2) esa ventana se
// traduce a un tramo local que empieza antes y termina después del día
// pedido - hay que recortarlo al día local exacto antes de pintarlo.
export function filterTimelineToDay(timeline: TimelineEntry[], day: string): TimelineEntry[] {
  const dayStart = parseDateOnly(day)
  const dayEnd = new Date(dayStart)
  dayEnd.setHours(23, 59, 59, 999)

  return timeline.filter((entry) => {
    const at = new Date(entry.at)
    return at >= dayStart && at <= dayEnd
  })
}

export type TimelineListItem =
  | { kind: 'separator'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: TimelineEntry }

// Un separador de día entre entradas de distinto día de calendario -
// en "hoy" la lista es "lo más reciente en general", que puede
// extenderse a ayer; en un día pasado es un único día, así que como
// mucho aparece un separador, haciendo de etiqueta para toda la lista.
// `en-CA` da una clave de agrupación yyyy-mm-dd estable, independiente
// del idioma - solo `formatDayLabel` (recibe la fecha real) decide cómo
// se ve.
export function groupTimelineByDay(
  timeline: TimelineEntry[],
  formatDayLabel: (at: Date) => string,
): TimelineListItem[] {
  const items: TimelineListItem[] = []
  let previousDayKey: string | null = null

  for (const entry of timeline) {
    const at = new Date(entry.at)
    const dayKey = at.toLocaleDateString('en-CA')
    if (dayKey !== previousDayKey) {
      items.push({ kind: 'separator', key: `day-${dayKey}`, label: formatDayLabel(at) })
      previousDayKey = dayKey
    }
    items.push({ kind: 'entry', key: `${entry.type}-${entry.data.id}`, entry })
  }

  return items
}
