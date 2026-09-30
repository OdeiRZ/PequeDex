import { defineStore } from 'pinia'
import { useFeedback } from '@/composables/useFeedback'

const DISPLAY_MS = 3000

export type ToastType = 'success' | 'error'

interface ToastState {
  message: string | null
  type: ToastType
  // Bumped on every show() so ToastNotification can force a fresh pop
  // animation even when the same message is shown twice in a row (Vue
  // wouldn't otherwise see the prop change and would skip the transition).
  key: number
  timeoutId: ReturnType<typeof setTimeout> | null
}

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    message: null,
    type: 'success',
    key: 0,
    timeoutId: null,
  }),

  actions: {
    // A single current message, not a queue: every caller so far is a
    // one-off confirmation right after a mutation (save, delete...), never
    // several at once, so a queue would be complexity nothing needs yet.
    // Showing a new one while another is visible just replaces it and
    // restarts the timer. Same pattern as LudoDex/MIRA MarketLens.
    show(message: string, type: ToastType = 'success') {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
      }

      this.message = message
      this.type = type
      this.key += 1
      this.timeoutId = setTimeout(() => {
        this.message = null
        this.timeoutId = null
      }, DISPLAY_MS)

      // El sonido/vibración de confirmación alargan la pop-in del propio
      // toast - la única confirmación que un móvil puede dar sin depender
      // de que la pantalla se esté mirando justo en ese instante. Antes
      // vibraba siempre y sin pasar por ningún ajuste; ahora queda gateado
      // por "Sonido y vibración al interactuar" como el resto de la app,
      // vía useFeedback() en vez de un navigator.vibrate() local aquí.
      const feedback = useFeedback()
      if (type === 'error') {
        feedback.error()
      } else {
        feedback.success()
      }
    },
  },
})
