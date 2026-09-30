import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// useSoundPlayer mantiene su propio estado a nivel de módulo (singleton
// real, no un ref nuevo por llamada - a propósito, para que el sonido
// siga sonando aunque SoundsView.vue se desmonte). Para comprobar cada
// escenario desde cero hay que resetear el registro de módulos y
// reimportarlo fresco en cada test, mismo criterio que useTheme.spec.ts
// de LudoDex usa para su propio composable singleton.
async function importFresh() {
  vi.resetModules()
  return await import('@/composables/useSoundPlayer')
}

let createdGainNodes: MockGainNode[] = []
let createdAudioElements: HTMLAudioElement[] = []

class MockGainNode {
  gain = {
    value: 1,
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
  }
  connect = vi.fn()
  disconnect = vi.fn()
}

class MockBufferSourceNode {
  buffer: unknown = null
  loop = false
  start = vi.fn()
  stop = vi.fn()
  disconnect = vi.fn()
  connect = vi.fn((dest: unknown) => dest)
}

class MockAudioContext {
  sampleRate = 44100
  currentTime = 0
  destination = {}
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return new MockBufferSourceNode()
  }
  createGain() {
    const node = new MockGainNode()
    createdGainNodes.push(node)
    return node
  }
  close() {
    return Promise.resolve()
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  createdGainNodes = []
  createdAudioElements = []

  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal(
    'MediaMetadata',
    class {
      constructor(public init: unknown) {}
    },
  )

  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
  HTMLMediaElement.prototype.load = vi.fn()

  class TrackedAudio extends Audio {
    constructor(...args: ConstructorParameters<typeof Audio>) {
      super(...args)
      createdAudioElements.push(this)
    }
  }
  vi.stubGlobal('Audio', TrackedAudio)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSoundPlayer', () => {
  it('counts down every second and stops on its own at zero', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, playing, remainingSeconds, totalSeconds } = useSoundPlayer()

    play('white-noise', '15')

    expect(playing.value).toBe(true)
    expect(totalSeconds.value).toBe(15 * 60)
    expect(remainingSeconds.value).toBe(15 * 60)

    vi.advanceTimersByTime(5000)
    expect(remainingSeconds.value).toBe(15 * 60 - 5)

    vi.advanceTimersByTime((15 * 60 - 5) * 1000)
    expect(remainingSeconds.value).toBe(0)
    expect(playing.value).toBe(false)
  })

  it('ramps the white-noise gain in on start, then to 0 once the last 10% of the duration starts', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play } = useSoundPlayer()

    play('white-noise', '15') // 900s total, fade window = last 90s
    const gain = createdGainNodes[0]!

    // Fundido de entrada: una llamada ya al arrancar, a un valor > 0.
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)
    const [fadeInTarget] = gain.gain.linearRampToValueAtTime.mock.calls[0]!
    expect(fadeInTarget).toBeGreaterThan(0)

    vi.advanceTimersByTime(700 * 1000) // still well outside the fade-out window
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(200 * 1000) // now inside the last 10%
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2)
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, expect.any(Number))
  })

  it('fades <audio> volume up from silence on start, then down gradually during the last 10%', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play } = useSoundPlayer()

    play('rain', '15') // 900s total, fade window = last 90s
    await Promise.resolve()
    const el = createdAudioElements[0]!
    expect(el.volume).toBe(0) // empieza en silencio, fundido de entrada

    vi.advanceTimersByTime(1500) // fundido de entrada completo (1.5s, fijo)
    expect(el.volume).toBe(1)

    vi.advanceTimersByTime(810 * 1000 - 1500) // llega a 90s restantes (810s desde el arranque)
    expect(el.volume).toBe(1) // linear ramp starts at 1 right at the boundary

    vi.advanceTimersByTime(30 * 1000) // 60s left - one third into the 90s fade window
    const volumeAfterOneTick = el.volume
    expect(volumeAfterOneTick).toBeLessThan(1)

    vi.advanceTimersByTime(30 * 1000) // 30s left - further into the fade
    expect(el.volume).toBeLessThan(volumeAfterOneTick)
    expect(el.volume).toBeGreaterThanOrEqual(0)
  })

  it('fades in from silence regardless of the chosen duration', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play } = useSoundPlayer()

    play('rain', 'unlimited')
    await Promise.resolve()
    const el = createdAudioElements[0]!
    expect(el.volume).toBe(0)

    vi.advanceTimersByTime(1500)
    expect(el.volume).toBe(1)
  })

  it('switching category mid-playback stops the previous sound before starting the next', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, category } = useSoundPlayer()

    play('white-noise', '30')
    const noiseStop = createdGainNodes[0]!.disconnect
    expect(category.value).toBe('white-noise')

    play('rain', '15')
    await Promise.resolve()

    expect(category.value).toBe('rain')
    expect(noiseStop).toHaveBeenCalled()
  })

  it('marks a category unavailable and stops instead of leaving it "playing" when playback fails', async () => {
    HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new Error('404'))
    const { useSoundPlayer } = await importFresh()
    const { play, playing, unavailable } = useSoundPlayer()

    play('rain', '30')
    await Promise.resolve()
    await Promise.resolve()

    expect(unavailable.value.has('rain')).toBe(true)
    expect(playing.value).toBe(false)
  })

  it('fades in but never fades out or auto-stops on "unlimited", even after a long time', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, playing, remainingSeconds } = useSoundPlayer()

    play('white-noise', 'unlimited')
    const gain = createdGainNodes[0]!

    // Solo la llamada del fundido de entrada - nunca un fundido de salida.
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2 * 60 * 60 * 1000)

    expect(playing.value).toBe(true)
    expect(remainingSeconds.value).toBe(0)
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)
    expect(gain.gain.linearRampToValueAtTime).not.toHaveBeenCalledWith(0, expect.any(Number))
  })

  it('changing duration mid fade-out cancels the stale white-noise ramp instead of leaving it silenced', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, setDuration } = useSoundPlayer()

    play('white-noise', '15') // 900s total, fade window = last 90s
    const gain = createdGainNodes[0]!

    vi.advanceTimersByTime(890 * 1000) // 10s left, deep in the fade-out window
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))

    // El usuario alarga la duración creyendo que seguirá sonando - sin la
    // cancelación, la rampa a 0 ya agendada seguiría silenciando el ruido
    // en su instante original pese a que la cuenta atrás se ha reiniciado.
    setDuration('60')

    expect(gain.gain.cancelScheduledValues).toHaveBeenCalled()
    const [restoredGain] = gain.gain.setValueAtTime.mock.calls[0]!
    expect(restoredGain).toBeGreaterThan(0)
  })

  it('changing duration mid fade-out restores full <audio> volume instead of leaving it lowered', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, setDuration } = useSoundPlayer()

    play('rain', '15') // 900s total, fade window = last 90s
    await Promise.resolve()
    const el = createdAudioElements[0]!

    vi.advanceTimersByTime(890 * 1000) // 10s left, deep in the fade-out window
    expect(el.volume).toBeLessThan(1)

    setDuration('unlimited')

    expect(el.volume).toBe(1)
  })

  it('changing duration while not fading out does not touch the volume/gain', async () => {
    const { useSoundPlayer } = await importFresh()
    const { play, setDuration } = useSoundPlayer()

    play('white-noise', '15')
    const gain = createdGainNodes[0]!
    gain.gain.cancelScheduledValues.mockClear()
    gain.gain.setValueAtTime.mockClear()

    vi.advanceTimersByTime(5000) // still nowhere near the fade window
    setDuration('30')

    expect(gain.gain.cancelScheduledValues).not.toHaveBeenCalled()
    expect(gain.gain.setValueAtTime).not.toHaveBeenCalled()
  })

  it('persists the last picked category/duration and preselects them on the next import', async () => {
    const { useSoundPlayer } = await importFresh()
    useSoundPlayer().play('lullaby', '45')
    await Promise.resolve()

    const stored = localStorage.getItem('pequedex_sound_last')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual({ category: 'lullaby', duration: '45' })

    const { useSoundPlayer: useSoundPlayerAgain } = await importFresh()
    const { category, durationOption } = useSoundPlayerAgain()
    expect(category.value).toBe('lullaby')
    expect(durationOption.value).toBe('45')
  })
})
