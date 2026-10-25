import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useScreenWakeLock } from '../useScreenWakeLock'

function fakeWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn> }[] = []
  const wakeLock = {
    request: vi.fn(async () => {
      const sentinel = {
        released: false,
        release: vi.fn(async () => {
          sentinel.released = true
        }),
      }
      sentinels.push(sentinel)
      return sentinel
    }),
  }
  return { wakeLock, sentinels }
}

function mountWith(active: Ref<boolean>, wakeLock: ReturnType<typeof fakeWakeLock>['wakeLock']) {
  return mount(
    defineComponent({
      setup() {
        useScreenWakeLock(() => active.value, wakeLock)
        return () => null
      },
    }),
  )
}

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useScreenWakeLock', () => {
  it('keeps the screen on while active and lets it go when not', async () => {
    const { wakeLock, sentinels } = fakeWakeLock()
    const active = ref(true)
    mountWith(active, wakeLock)
    await flush()
    expect(wakeLock.request).toHaveBeenCalledWith('screen')

    active.value = false
    await flush()
    expect(sentinels[0]!.release).toHaveBeenCalled()
  })

  it('does not ask while inactive and releases on unmount', async () => {
    const { wakeLock, sentinels } = fakeWakeLock()
    const active = ref(false)
    const wrapper = mountWith(active, wakeLock)
    await flush()
    expect(wakeLock.request).not.toHaveBeenCalled()

    active.value = true
    await flush()
    wrapper.unmount()
    await flush()
    expect(sentinels[0]!.release).toHaveBeenCalled()
  })

  it('asks again when the page comes back after the browser released it', async () => {
    const { wakeLock, sentinels } = fakeWakeLock()
    mountWith(ref(true), wakeLock)
    await flush()

    sentinels[0]!.released = true // el navegador lo suelta al ocultarse la página
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(wakeLock.request).toHaveBeenCalledTimes(2)
  })

  it('does nothing without the API', async () => {
    const wrapper = mountWith(ref(true), undefined as never)
    await flush()
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
