import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore, type User } from '@/stores/auth'

// useFeedback.ts guarda el AudioContext como estado de módulo (para
// reutilizarlo entre llamadas, ver el propio fichero) - hay que resetear
// el registro de módulos y reimportarlo fresco en cada test para que un
// AudioContext creado en un test anterior no enmascare lo que este test
// intenta comprobar, mismo criterio que useSoundPlayer.spec.ts.
async function importFresh() {
  vi.resetModules()
  return await import('@/composables/useFeedback')
}

class MockOscillatorNode {
  type = 'sine'
  frequency = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  connect = vi.fn((dest: unknown) => dest)
  start = vi.fn()
  stop = vi.fn()
}

class MockGainNode {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  }
  connect = vi.fn((dest: unknown) => dest)
}

class MockAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  resume = vi.fn()
  createOscillator() {
    return new MockOscillatorNode()
  }
  createGain() {
    return new MockGainNode()
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useFeedback', () => {
  it('vibrates with a distinct pattern per kind when enabled (default, no user yet)', async () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    vi.stubGlobal('AudioContext', MockAudioContext)
    const { useFeedback } = await importFresh()
    const feedback = useFeedback()

    feedback.tap()
    feedback.success()
    feedback.error()

    expect(vibrate).toHaveBeenNthCalledWith(1, 8)
    expect(vibrate).toHaveBeenNthCalledWith(2, 10)
    expect(vibrate).toHaveBeenNthCalledWith(3, [12, 40, 12])
  })

  it('vibrates with a distinct pattern for each of the newer kinds', async () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    vi.stubGlobal('AudioContext', MockAudioContext)
    const { useFeedback } = await importFresh()
    const feedback = useFeedback()

    feedback.cancel()
    feedback.select()
    feedback.nav()
    feedback.navBack()
    feedback.theme()
    feedback.tick()

    expect(vibrate).toHaveBeenNthCalledWith(1, 6)
    expect(vibrate).toHaveBeenNthCalledWith(2, [5, 18, 5])
    expect(vibrate).toHaveBeenNthCalledWith(3, 14)
    expect(vibrate).toHaveBeenNthCalledWith(4, 10)
    expect(vibrate).toHaveBeenNthCalledWith(5, 16)
    expect(vibrate).toHaveBeenNthCalledWith(6, 3)

    // Todas distintas entre sí y de tap/success/error.
    const allPatterns = vibrate.mock.calls.map((call) => JSON.stringify(call[0]))
    expect(new Set(allPatterns).size).toBe(allPatterns.length)
  })

  it('warnVibrate only vibrates, never plays a tone', async () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    class CountingAudioContext extends MockAudioContext {
      static instanceCount = 0
      constructor() {
        super()
        CountingAudioContext.instanceCount++
      }
    }
    vi.stubGlobal('AudioContext', CountingAudioContext)
    const { useFeedback } = await importFresh()

    useFeedback().warnVibrate()

    expect(vibrate).toHaveBeenCalledWith(6)
    expect(CountingAudioContext.instanceCount).toBe(0)
  })

  it('warnVibrate respects the same gate as the rest', async () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    vi.stubGlobal('AudioContext', MockAudioContext)
    useAuthStore().user = { interaction_feedback_enabled: false } as unknown as User
    const { useFeedback } = await importFresh()

    useFeedback().warnVibrate()

    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does nothing at all when interaction_feedback_enabled is off', async () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    vi.stubGlobal('AudioContext', MockAudioContext)
    useAuthStore().user = { interaction_feedback_enabled: false } as unknown as User
    const { useFeedback } = await importFresh()

    useFeedback().tap()

    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does not throw when navigator.vibrate does not exist (desktop, iOS Safari)', async () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined })
    vi.stubGlobal('AudioContext', MockAudioContext)
    const { useFeedback } = await importFresh()

    expect(() => useFeedback().tap()).not.toThrow()
  })

  it('does not throw when AudioContext does not exist (older browsers, other test environments)', async () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined })
    vi.stubGlobal('AudioContext', undefined)
    const { useFeedback } = await importFresh()

    expect(() => useFeedback().tap()).not.toThrow()
  })

  it('reuses a single AudioContext across calls instead of opening one per tone', async () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined })
    class CountingAudioContext extends MockAudioContext {
      static instanceCount = 0
      constructor() {
        super()
        CountingAudioContext.instanceCount++
      }
    }
    vi.stubGlobal('AudioContext', CountingAudioContext)
    const { useFeedback } = await importFresh()
    const feedback = useFeedback()

    feedback.tap()
    feedback.tap()
    feedback.success()

    expect(CountingAudioContext.instanceCount).toBe(1)
  })
})
