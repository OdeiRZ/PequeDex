import { defineStore } from 'pinia'
import { isNetworkError } from '@/lib/offlineQueue'
import { loadWrites, saveWrites, upsertWrite, type PendingWrite } from '@/lib/pendingWrites'

/** Lo que espera un cambio antes de darlo por "guardado en el móvil" y seguir:
 * si el servidor contesta en este tiempo, el guardado es normal (y un error de
 * validación llega al formulario); si no, queda pendiente y se envía por detrás. */
export const COMMIT_GRACE_MS = 1_500

/** Lo único que la cola necesita de la API (un `apiClient` de axios lo cumple).
 * Se recibe de quien la usa en vez de importarlo: lib/api importa los stores
 * (para cerrar la sesión con un 401) y un import circular aquí daría problemas. */
export interface WriteTransport {
  put(url: string, data?: unknown, config?: { timeout?: number }): Promise<unknown>
  delete(url: string, config?: { timeout?: number }): Promise<unknown>
}

const REQUEST_TIMEOUT_MS = 20_000
const MAX_PASSES = 5

let inFlight: Promise<{ sent: number; rejected: number }> | null = null
let sequence = 0
// Quién espera el veredicto de qué escritura (ver commit): fuera del estado de
// Pinia porque no se guarda ni se pinta.
const awaiting = new Set<string>()
const verdicts = new Map<string, unknown>()

function timer(ms: number): { done: Promise<void>; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout> | undefined
  const done = new Promise<void>((resolve) => {
    handle = setTimeout(resolve, ms)
  })
  return { done, cancel: () => clearTimeout(handle) }
}

function isUnreachable(error: unknown): boolean {
  return isNetworkError(error) || (error as { code?: string }).code === 'ERR_CANCELED'
}

export const usePendingWritesStore = defineStore('pendingWrites', {
  state: () => ({
    items: loadWrites(),
    /** Cuántas escrituras rechazó el servidor sin que nadie esperara la respuesta. */
    rejectedNotice: 0,
  }),

  getters: {
    count: (state) => state.items.length,
  },

  actions: {
    drop(write: PendingWrite) {
      this.items = this.items.filter((item) => item.id !== write.id)
      saveWrites(this.items)
    },

    /** Guarda el cambio en cola y lo intenta enviar. Devuelve `'saved'` si el
     * servidor lo aceptó enseguida y `'queued'` si queda pendiente (sin red o
     * con el servidor lento); si el servidor lo rechaza, relanza el error. Quien
     * llama aplica antes el cambio en pantalla y lo deshace si esto falla. */
    async commit(
      change: Pick<PendingWrite, 'key' | 'method' | 'url' | 'body'>,
      transport: WriteTransport,
    ): Promise<'saved' | 'queued'> {
      const write: PendingWrite = {
        ...change,
        id: `${Date.now()}-${sequence++}`,
        queuedAt: new Date().toISOString(),
      }
      this.items = upsertWrite(this.items, write)
      saveWrites(this.items)

      awaiting.add(write.id)
      const wait = timer(COMMIT_GRACE_MS)
      try {
        await Promise.race([this.flush(transport), wait.done])
      } finally {
        wait.cancel()
        awaiting.delete(write.id)
      }

      if (verdicts.has(write.id)) {
        const error = verdicts.get(write.id)
        verdicts.delete(write.id)
        throw error
      }
      return this.items.some((item) => item.id === write.id) ? 'queued' : 'saved'
    },

    /** Envía lo pendiente, de una en una y en orden. Para en el primer fallo
     * de red (lo demás sigue en cola); lo que el servidor rechaza se descarta. */
    flush(transport: WriteTransport): Promise<{ sent: number; rejected: number }> {
      if (inFlight) return inFlight
      if (this.items.length === 0) return Promise.resolve({ sent: 0, rejected: 0 })

      inFlight = this.run(transport).finally(() => {
        inFlight = null
      })
      return inFlight
    },

    async run(transport: WriteTransport): Promise<{ sent: number; rejected: number }> {
      let sent = 0
      let rejected = 0

      // Repite mientras entren cambios nuevos durante el envío.
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const batch = [...this.items]
        if (batch.length === 0) break

        for (const write of batch) {
          try {
            const config = { timeout: REQUEST_TIMEOUT_MS }
            if (write.method === 'delete') await transport.delete(write.url, config)
            else await transport.put(write.url, write.body, config)
            this.drop(write)
            sent++
          } catch (error) {
            if (isUnreachable(error)) return { sent, rejected }
            this.drop(write)
            rejected++
            if (awaiting.has(write.id)) verdicts.set(write.id, error)
            else this.rejectedNotice++
          }
        }
      }

      return { sent, rejected }
    },

    clear() {
      this.items = []
      saveWrites([])
    },
  },
})
