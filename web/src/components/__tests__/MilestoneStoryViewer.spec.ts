import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MilestoneStoryViewer from '@/components/MilestoneStoryViewer.vue'
import { i18n } from '@/i18n'
import type { Milestone } from '@/stores/babies'

// Pinned rather than left to fall back on jsdom's own navigator.language
// (getStoredLocale()) - deterministic regardless of the environment
// running the suite, and matches this app's real primary language.
beforeEach(() => {
  i18n.global.locale.value = 'es'
})

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 1,
    baby_id: 1,
    user_id: 1,
    achieved_at: '2026-01-01',
    title: 'Primera sonrisa',
    category: null,
    description: null,
    photo_path: null,
    photo_url: null,
    liked_by: [],
    ...overrides,
  }
}

// Teleport moves the viewer's real DOM into document.body, outside the
// wrapper's own tracked tree - unmounting every wrapper after each test
// (even if an assertion throws mid-test) keeps a leftover teleported
// dialog from one test polluting document.body for the next one, same
// pattern as BottomSheet.spec.ts.
const wrappers: VueWrapper[] = []

function mountViewer(milestone: Milestone = makeMilestone()) {
  const wrapper = mount(MilestoneStoryViewer, {
    props: {
      milestone,
      index: 0,
      total: 1,
      isFirst: true,
      isLast: true,
      isLiked: false,
      dateLocale: 'es-ES',
    },
    global: { plugins: [i18n] },
    // attachTo: document.body - needed for document.activeElement to
    // actually reflect these focus() calls in jsdom, same pattern as
    // LudoDex's GameDetailModal and this app's own BottomSheet.
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

// Plain DOM query, not wrapper.find(): the viewer's real content lives
// inside a <Teleport to="body">, outside the wrapper's own tracked tree.
function dialog(): HTMLElement {
  return document.body.querySelector('[role="dialog"]')!
}

describe('MilestoneStoryViewer', () => {
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  describe('focus management', () => {
    it('moves focus to the viewer itself when it opens', () => {
      mountViewer()

      expect(document.activeElement).toBe(dialog())
    })

    it('returns focus to whatever triggered the viewer once it closes', () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      trigger.focus()

      const wrapper = mountViewer()
      expect(document.activeElement).not.toBe(trigger)

      wrapper.unmount()
      wrappers.pop()

      expect(document.activeElement).toBe(trigger)
      trigger.remove()
    })

    it('wraps Tab from the last focusable element back to the first, instead of escaping the viewer', () => {
      mountViewer(makeMilestone({ description: 'Una descripción' }))

      const closeButton = dialog().querySelector<HTMLElement>('[aria-label="Cerrar"]')!
      const deleteButton = dialog().querySelector<HTMLElement>('[aria-label="Borrar"]')!
      deleteButton.focus()
      expect(document.activeElement).toBe(deleteButton)

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      )

      expect(document.activeElement).toBe(closeButton)
    })

    it('wraps Shift+Tab from the first focusable element back to the last', () => {
      mountViewer(makeMilestone({ description: 'Una descripción' }))

      const closeButton = dialog().querySelector<HTMLElement>('[aria-label="Cerrar"]')!
      const deleteButton = dialog().querySelector<HTMLElement>('[aria-label="Borrar"]')!
      closeButton.focus()
      expect(document.activeElement).toBe(closeButton)

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      )

      expect(document.activeElement).toBe(deleteButton)
    })
  })

  it('sets aria-label to the milestone title', () => {
    mountViewer(makeMilestone({ title: 'Primer paso' }))

    expect(dialog().getAttribute('aria-label')).toBe('Primer paso')
  })
})
