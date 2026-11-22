import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useBabiesStore } from '@/stores/babies'
import { addDays, todayDateOnlyString } from '@/lib/localDate'
import { useFeedback } from './useFeedback'

export type VitaminDCardState = 'pending' | 'confirmed' | 'hidden'

/** Días de dosis que el servidor manda con la pauta (VitaminDScheduleController::show). */
export const VITAMIN_D_RECENT_DAYS = 14

/**
 * ¿Hace falta el historial completo para hablar de `day`? Las dosis recientes
 * cubren desde hoy-14 en UTC, que al oeste de UTC es hoy-13 en local; y la
 * tarjeta también mira el día anterior, de ahí el margen de 2.
 */
export function needsFullVitaminDHistory(day: string): boolean {
  return day < addDays(todayDateOnlyString(), -(VITAMIN_D_RECENT_DAYS - 2))
}

/**
 * Pure derivation of the Dashboard reminder card's state from the
 * store, so the 3-state logic (pending/confirmed/hidden) can be tested
 * without mounting VitaminDReminderCard.vue.
 *
 * `day` es el día que se mira (YYYY-MM-DD, local): el que está abierto en
 * "Ritmo", para que la tarjeta diga si se dio la vitamina ESE día y "Dar"
 * marque ese día, no siempre hoy. Sin él, hoy.
 */
export function useVitaminDReminder(day: MaybeRefOrGetter<string> = todayDateOnlyString) {
  const babies = useBabiesStore()
  const feedback = useFeedback()

  const selectedDay = computed(() => toValue(day))
  const dayBefore = computed(() => addDays(selectedDay.value, -1))
  const isToday = computed(() => selectedDay.value === todayDateOnlyString())

  // Las de los últimos 14 días llegan con la pauta; un día más antiguo solo
  // está en el historial completo (vitaminDAllDoses), que el Dashboard pide
  // al navegar hasta él. Ese array solo vale si es del bebé actual.
  const historyLoaded = computed(
    () => babies.vitaminDAllDosesFor !== null && babies.vitaminDAllDosesFor === babies.current?.id,
  )

  function doseOn(date: string) {
    const recent = babies.vitaminDRecentDoses.find((d) => d.date === date)
    if (recent) return recent
    if (!historyLoaded.value) return null
    return babies.vitaminDAllDoses.find((d) => d.date === date) ?? null
  }

  const cardState = computed<VitaminDCardState>(() => {
    const schedule = babies.vitaminDSchedule
    if (!schedule || !schedule.enabled) return 'hidden'
    if (selectedDay.value < schedule.start_date || selectedDay.value > schedule.end_date) {
      return 'hidden'
    }
    // Sin el historial no se sabe si se dio: mejor nada que "sin marcar" en falso.
    if (needsFullVitaminDHistory(selectedDay.value) && !historyLoaded.value) return 'hidden'
    return doseOn(selectedDay.value)?.given ? 'confirmed' : 'pending'
  })

  // Hay registro y es "No dada": no es lo mismo que no haber marcado nada.
  const markedNotGiven = computed(() => doseOn(selectedDay.value)?.given === false)

  // Only reinforces the message when the pauta was already running the
  // day before too - a schedule activated that same day has no previous
  // day to have missed.
  const dayBeforeAlsoMissing = computed(() => {
    if (cardState.value !== 'pending') return false
    const schedule = babies.vitaminDSchedule
    if (!schedule || dayBefore.value < schedule.start_date) return false
    return !(doseOn(dayBefore.value)?.given ?? false)
  })

  async function markDay(given: boolean) {
    feedback.tap()
    try {
      await babies.upsertVitaminDDose(selectedDay.value, given)
      if (given) feedback.success()
    } catch (error) {
      feedback.error()
      throw error
    }
  }

  return {
    selectedDay,
    isToday,
    cardState,
    markedNotGiven,
    dayBeforeAlsoMissing,
    markDay,
  }
}
