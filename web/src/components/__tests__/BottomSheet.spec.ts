import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import BottomSheet from '@/components/BottomSheet.vue'

// Teleport moves the sheet's real DOM into document.body, outside each
// wrapper's own tracked tree - unmounting every wrapper after each test
// keeps that (and the shared scroll-lock counter in bodyScrollLock.ts)
// from leaking into the next one.
const wrappers: VueWrapper[] = []

function mountSheet(open: boolean) {
  const wrapper = mount(BottomSheet, { props: { open } })
  wrappers.push(wrapper)
  return wrapper
}

describe('BottomSheet', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('locks body scroll while open and restores it on close', async () => {
    const wrapper = mountSheet(false)

    expect(document.body.style.overflow).toBe('')

    await wrapper.setProps({ open: true })
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ open: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('restores whatever overflow the body already had, not just the default', async () => {
    document.body.style.overflow = 'scroll'
    const wrapper = mountSheet(true)

    await wrapper.setProps({ open: false })

    expect(document.body.style.overflow).toBe('scroll')
    document.body.style.overflow = ''
  })

  it('keeps the lock while a second sheet is still open, e.g. two rendered at once', async () => {
    const first = mountSheet(true)
    mountSheet(true)

    await first.setProps({ open: false })
    // The dashboard renders one BottomSheet per quick-log/settings/detail
    // sheet, all mounted simultaneously - closing one must not unlock
    // scroll for the page while another is still covering it.
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('unlocks on unmount if it was still open', () => {
    const wrapper = mountSheet(true)

    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    wrappers.pop()

    expect(document.body.style.overflow).toBe('')
  })

  it('emits update:open false when the backdrop is clicked', async () => {
    const wrapper = mountSheet(true)

    // A plain DOM query, not wrapper.find(): the teleported backdrop
    // lives in document.body, outside the wrapper's own tracked tree.
    const backdrop = document.body.querySelector('.fixed.inset-0')
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  describe('focus management', () => {
    // attachTo: document.body (not the default detached container) -
    // needed for document.activeElement to actually reflect these
    // focus() calls in jsdom, same as LudoDex's GameDetailModal tests.
    it('moves focus to the panel when it opens', async () => {
      const wrapper = mount(BottomSheet, { props: { open: false }, attachTo: document.body })
      wrappers.push(wrapper)

      await wrapper.setProps({ open: true })

      expect(document.activeElement).toBe(document.body.querySelector('[role="dialog"]'))
    })

    it('returns focus to whatever triggered the sheet once it closes', async () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      trigger.focus()

      const wrapper = mount(BottomSheet, { props: { open: false }, attachTo: document.body })
      wrappers.push(wrapper)

      await wrapper.setProps({ open: true })
      expect(document.activeElement).not.toBe(trigger)

      await wrapper.setProps({ open: false })
      expect(document.activeElement).toBe(trigger)

      trigger.remove()
    })

    it('closes on Escape', async () => {
      const wrapper = mount(BottomSheet, { props: { open: true }, attachTo: document.body })
      wrappers.push(wrapper)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:open')).toEqual([[false]])
    })

    it('wraps Tab from the last focusable element back to the first', async () => {
      const wrapper = mount(BottomSheet, {
        props: { open: true },
        attachTo: document.body,
        slots: {
          default: '<button id="a">A</button><button id="b">B</button>',
        },
      })
      wrappers.push(wrapper)
      await wrapper.vm.$nextTick()

      const first = document.body.querySelector<HTMLElement>('#a')!
      const last = document.body.querySelector<HTMLElement>('#b')!
      last.focus()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))

      expect(document.activeElement).toBe(first)
    })

    it('wraps Shift+Tab from the first focusable element back to the last', async () => {
      const wrapper = mount(BottomSheet, {
        props: { open: true },
        attachTo: document.body,
        slots: {
          default: '<button id="a">A</button><button id="b">B</button>',
        },
      })
      wrappers.push(wrapper)
      await wrapper.vm.$nextTick()

      const first = document.body.querySelector<HTMLElement>('#a')!
      const last = document.body.querySelector<HTMLElement>('#b')!
      first.focus()

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
      )

      expect(document.activeElement).toBe(last)
    })
  })
})
