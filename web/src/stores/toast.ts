import { defineStore } from 'pinia'

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

// A short buzz alongside the toast's own pop-in - the one bit of
// confirmation a phone can give that doesn't depend on the screen being
// looked at right that instant. Feature-detected (desktop browsers, and
// iOS Safari entirely, have no navigator.vibrate) and wrapped in try/catch
// since some embedded/permission-restricted contexts throw instead of
// just no-op'ing. Two short pulses for an error reads as distinct from
// a single success buzz without needing to look at the toast's color.
function hapticBuzz(type: ToastType) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return

  try {
    navigator.vibrate(type === 'error' ? [12, 40, 12] : 10)
  } catch {
    // Ignored - haptics are a nice-to-have, never worth surfacing an error for.
  }
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

      hapticBuzz(type)
    },
  },
})
