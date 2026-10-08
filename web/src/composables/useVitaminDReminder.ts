import { computed } from 'vue'
import { useBabiesStore } from '@/stores/babies'
import { addDays, todayDateOnlyString } from '@/lib/localDate'
import { useFeedback } from './useFeedback'

export type VitaminDCardState = 'pending' | 'confirmed' | 'hidden'

/**
 * Pure derivation of the Dashboard reminder card's state from the
 * store, so the 3-state logic (pending/confirmed/hidden) can be tested
 * without mounting VitaminDReminderCard.vue.
 */
export function useVitaminDReminder() {
  const babies = useBabiesStore()
  const feedback = useFeedback()

  const today = computed(() => todayDateOnlyString())
  const yesterday = computed(() => addDays(today.value, -1))

  const todayDose = computed(
    () => babies.vitaminDRecentDoses.find((d) => d.date === today.value) ?? null,
  )
  const yesterdayDose = computed(
    () => babies.vitaminDRecentDoses.find((d) => d.date === yesterday.value) ?? null,
  )

  const cardState = computed<VitaminDCardState>(() => {
    const schedule = babies.vitaminDSchedule
    if (!schedule || !schedule.enabled) return 'hidden'
    if (today.value < schedule.start_date || today.value > schedule.end_date) return 'hidden'
    return todayDose.value?.given ? 'confirmed' : 'pending'
  })

  // Only reinforces the message when the pauta was already running
  // yesterday too - a schedule activated today has no "yesterday" to
  // have missed.
  const yesterdayAlsoMissing = computed(() => {
    if (cardState.value !== 'pending') return false
    const schedule = babies.vitaminDSchedule
    if (!schedule || yesterday.value < schedule.start_date) return false
    return !(yesterdayDose.value?.given ?? false)
  })

  async function markToday(given: boolean) {
    feedback.tap()
    try {
      await babies.upsertVitaminDDose(today.value, given)
      if (given) feedback.success()
    } catch (error) {
      feedback.error()
      throw error
    }
  }

  return {
    cardState,
    yesterdayAlsoMissing,
    markToday,
  }
}
