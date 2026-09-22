import type { Directive } from 'vue'

const PRESS_CLASS = 'is-pressed'

// .btn-primary:active:not(:disabled)/.btn-ghost:active:not(:disabled)
// (base.css) never get to render on a button whose own click handler
// synchronously flips a `disabled` ref (every submit/action button in the
// app: guardar, eliminar...) - a disabled element can't match :active at
// all, and Vue's reactive patch applies `disabled` before the browser
// paints a frame with the pointer still down. Same bug/fix as LudoDex's
// and MIRA_MarketLens's own directives/press.ts - this drives the same
// "pressed" look through a plain class instead, added on pointerdown
// (before that patch lands) and always removed - via pointerup/cancel/
// leave normally, or the fallback timeout below on the buttons that do go
// on to disable themselves mid-press.
const RELEASE_FALLBACK_MS = 200

export const vPress: Directive<HTMLElement> = {
  mounted(el) {
    let timeoutId: ReturnType<typeof window.setTimeout> | undefined

    const release = () => {
      window.clearTimeout(timeoutId)
      el.classList.remove(PRESS_CLASS)
    }

    const press = () => {
      el.classList.add(PRESS_CLASS)
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(release, RELEASE_FALLBACK_MS)
    }

    el.addEventListener('pointerdown', press)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('pointerleave', release)

    Reflect.set(el, '__pressCleanup', () => {
      window.clearTimeout(timeoutId)
      el.removeEventListener('pointerdown', press)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('pointerleave', release)
    })
  },

  unmounted(el) {
    const cleanup = Reflect.get(el, '__pressCleanup') as (() => void) | undefined
    cleanup?.()
  },
}
