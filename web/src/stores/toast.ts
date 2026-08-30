import { defineStore } from 'pinia'

const DISPLAY_MS = 3000

interface ToastState {
  message: string | null
  timeoutId: ReturnType<typeof setTimeout> | null
}

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    message: null,
    timeoutId: null,
  }),

  actions: {
    // A single current message, not a queue: every caller so far is a
    // one-off confirmation right after a mutation (save, delete...), never
    // several at once, so a queue would be complexity nothing needs yet.
    // Showing a new one while another is visible just replaces it and
    // restarts the timer. Same pattern as LudoDex/MIRA MarketLens.
    show(message: string) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
      }

      this.message = message
      this.timeoutId = setTimeout(() => {
        this.message = null
        this.timeoutId = null
      }, DISPLAY_MS)
    },
  },
})
