import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RETRY_DELAYS_MS,
  STUCK_AFTER_MS,
  probeServer,
  startBackgroundSync,
  warmUpApi,
  type BackgroundSync,
} from '@/lib/backgroundSync'

describe('probeServer / warmUpApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('says the server is reachable on any answer, even an error status', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await probeServer()).toBe(true)
    // /up cuelga de la raíz del servidor, no de /api, y sin petición previa de CORS.
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/up$/)
    expect(url).not.toMatch(/\/api\/up$/)
    expect(options.mode).toBe('no-cors')
  })

  it('says it is unreachable when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    expect(await probeServer()).toBe(false)
  })

  it('gives up after the timeout when the server never answers', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () =>
              reject(new DOMException('x', 'AbortError')),
            )
          }),
      ),
    )

    const result = probeServer(3_000)
    await vi.advanceTimersByTimeAsync(3_001)

    expect(await result).toBe(false)
    vi.useRealTimers()
  })

  it('warms the API up without waiting or throwing when it is unreachable', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    expect(() => warmUpApi()).not.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('startBackgroundSync', () => {
  let pending: number
  let sync: BackgroundSync | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    pending = 0
  })

  afterEach(() => {
    sync?.stop()
    sync = null
    vi.useRealTimers()
  })

  function start(overrides: Partial<Parameters<typeof startBackgroundSync>[0]> = {}) {
    const flush = vi.fn(async () => {
      pending = 0
      return { sent: 1 }
    })
    const probe = vi.fn(async () => true)
    const abortStuck = vi.fn()
    const onSent = vi.fn()
    sync = startBackgroundSync({
      pendingCount: () => pending,
      flush,
      abortStuck,
      probe,
      onSent,
      ...overrides,
    })
    return { flush, probe, abortStuck, onSent }
  }

  it('does nothing while there is nothing pending', async () => {
    const { flush, probe } = start()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(probe).not.toHaveBeenCalled()
    expect(flush).not.toHaveBeenCalled()
  })

  it('sends a new pending record after the first short delay and reports it', async () => {
    const { flush, onSent } = start()
    pending = 1

    sync!.notifyPending()
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! - 1)
    expect(flush).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)

    expect(flush).toHaveBeenCalledTimes(1)
    expect(onSent).toHaveBeenCalledWith(1)
  })

  it('retries with growing short delays while the send keeps failing, then stops once it works', async () => {
    let failures = 2
    const flush = vi.fn(async () => {
      if (failures-- > 0) return { sent: 0 }
      pending = 0
      return { sent: 1 }
    })
    start({ flush })
    pending = 1
    sync!.notifyPending()

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! + 1) // 1.º intento: falla
    expect(flush).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]! - 10)
    expect(flush).toHaveBeenCalledTimes(1) // todavía esperando la 2.ª espera
    await vi.advanceTimersByTimeAsync(20) // 2.º intento: falla
    expect(flush).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2]! + 1) // 3.º: funciona
    expect(flush).toHaveBeenCalledTimes(3)

    // Sin nada pendiente ya no se vuelve a intentar.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(flush).toHaveBeenCalledTimes(3)
  })

  it('does not launch a send while the server does not answer the probe', async () => {
    let reachable = false
    const probe = vi.fn(async () => reachable)
    const { flush } = start({ probe })
    pending = 1
    sync!.notifyPending()

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! + 1)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(flush).not.toHaveBeenCalled()

    reachable = true
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]! + 1)

    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('once the server answers, cuts a send that has been hanging for a while before resending', async () => {
    const { flush, abortStuck } = start()
    pending = 1
    sync!.notifyPending()

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! + 1)

    expect(abortStuck).toHaveBeenCalledWith(STUCK_AFTER_MS)
    expect(abortStuck.mock.invocationCallOrder[0]!).toBeLessThan(flush.mock.invocationCallOrder[0]!)
  })

  it('retryNow cuts the stuck send and retries at once, without waiting for the delay', async () => {
    const { flush, abortStuck } = start()
    pending = 1

    sync!.retryNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(abortStuck).toHaveBeenNthCalledWith(1) // sin edad mínima: siempre
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('a cycle stuck on the old connection does not block the retry that follows', async () => {
    let first = true
    const stuck = new Promise<{ sent: number }>(() => {})
    const flush = vi.fn(async () => {
      if (first) {
        first = false
        return stuck
      }
      pending = 0
      return { sent: 1 }
    })
    start({ flush })
    pending = 1
    sync!.notifyPending()
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! + 1) // el 1.º envío queda colgado
    expect(flush).toHaveBeenCalledTimes(1)

    sync!.retryNow() // vuelve la conexión
    await vi.advanceTimersByTimeAsync(0)

    expect(flush).toHaveBeenCalledTimes(2)
    expect(pending).toBe(0)
  })

  it('reacts to the browser coming back online', async () => {
    const { flush, abortStuck } = start()
    pending = 1

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(abortStuck).toHaveBeenCalled()
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('stops reacting after stop()', async () => {
    const { flush } = start()
    pending = 1
    sync!.stop()

    window.dispatchEvent(new Event('online'))
    sync!.notifyPending()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(flush).not.toHaveBeenCalled()
  })
})
