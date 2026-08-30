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
})
