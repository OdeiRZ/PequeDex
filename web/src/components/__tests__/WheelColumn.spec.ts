import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WheelColumn from '@/components/WheelColumn.vue'

// jsdom doesn't implement Element.scrollTo at all (real browsers do) -
// this stands in with the same "just set the properties" behavior real
// engines give behavior: 'auto', which is all the tests below need.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (options?: ScrollToOptions | number, y?: number) {
    if (typeof options === 'object' && options !== null) {
      if (options.top !== undefined) this.scrollTop = options.top
      if (options.left !== undefined) this.scrollLeft = options.left
    } else if (typeof options === 'number') {
      this.scrollLeft = options
      if (y !== undefined) this.scrollTop = y
    }
  }
}

const ITEM_HEIGHT = 40

const items = [
  { value: 1, label: 'Uno' },
  { value: 2, label: 'Dos' },
  { value: 3, label: 'Tres' },
]

const wrappers: VueWrapper[] = []

function mountWheel(modelValue: number) {
  const wrapper = mount(WheelColumn, {
    props: { items, modelValue, ariaLabel: 'Ejemplo' },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('WheelColumn', () => {
  beforeEach(() => {
    // useFeedback() lee interaction_feedback_enabled de useAuthStore() en
    // cada tick - sin una Pinia activa, el propio onScroll (que ahora
    // dispara un tick por fila cruzada) lanzaría "no active pinia" en
    // cuanto hubiera un usuario que probar.
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })

  it('scrolls to the initial modelValue on mount', () => {
    const wrapper = mountWheel(2)
    const el = wrapper.get('[role="listbox"]').element

    expect(el.scrollTop).toBe(1 * ITEM_HEIGHT)
  })

  it('emits update:modelValue with the item nearest the center once scrolling settles', () => {
    const wrapper = mountWheel(1)
    const el = wrapper.get('[role="listbox"]').element

    // Clears the programmatic-scroll guard from mount's own initial
    // scrollToIndex() call (its 0ms reset timeout hasn't run yet under
    // fake timers), so the scroll below is treated as the user's own.
    vi.advanceTimersByTime(0)

    el.scrollTop = 2 * ITEM_HEIGHT
    wrapper.get('[role="listbox"]').trigger('scroll')

    // Not yet - only commits after the settle delay, so a still-scrolling
    // flick doesn't emit a new value on every intermediate frame.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    vi.advanceTimersByTime(150)

    expect(wrapper.emitted('update:modelValue')).toEqual([[3]])
  })

  it('re-scrolls when modelValue changes from outside (e.g. a parent reset)', () => {
    const wrapper = mountWheel(1)
    const el = wrapper.get('[role="listbox"]').element

    return wrapper.setProps({ modelValue: 3 }).then(() => {
      expect(el.scrollTop).toBe(2 * ITEM_HEIGHT)
    })
  })

  it('emits update:modelValue immediately when an item is clicked, without waiting for the scroll to settle', async () => {
    const wrapper = mountWheel(1)
    vi.advanceTimersByTime(0) // clears mount's own programmatic-scroll guard

    await wrapper.findAll('[role="option"]')[2]!.trigger('click') // "Tres"

    expect(wrapper.emitted('update:modelValue')).toEqual([[3]])
  })
})
