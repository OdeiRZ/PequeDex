import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useBabiesStore } from '@/stores/babies'
import { addDays, todayDateOnlyString } from '@/lib/localDate'
import { useFeedback } from './useFeedback'

export type VitaminDCardState = 'pending' | 'confirmed' | 'hidden'

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
  // al navegar hasta él.
  function doseOn(date: string) {
    return (
      babies.vitaminDRecentDoses.find((d) => d.date === date) ??
      babies.vitaminDAllDoses.find((d) => d.date === date) ??
      null
    )
  }

  const cardState = computed<VitaminDCardState>(() => {
    const schedule = babies.vitaminDSchedule
    if (!schedule || !schedule.enabled) return 'hidden'
    if (selectedDay.value < schedule.start_date || selectedDay.value > schedule.end_date) {
      return 'hidden'
    }
    return doseOn(selectedDay.value)?.given ? 'confirmed' : 'pending'
  })

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
    dayBeforeAlsoMissing,
    markDay,
  }
}
