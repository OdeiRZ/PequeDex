import type { TimelineEntry } from '@/stores/babies'

// Registro sin conexión: si al crear una toma, un sueño, un pañal o una
// temperatura no hay red, el registro se guarda en esta cola (en el
// propio móvil, localStorage - unos pocos KB, sin servicios externos) y
// se envía solo al volver la conexión. Cada uno lleva un `client_uuid`
// generado aquí: si un envío llega al servidor pero la respuesta se
// pierde, el reintento no lo duplica (ver CreatesIdempotently en la API).
// Solo crear: editar o borrar registros ya guardados sigue necesitando
// conexión.

export type QueuedLogType = 'feed' | 'sleep' | 'diaper_change' | 'temperature'

export interface QueuedLog {
  clientUuid: string
  /** Id negativo provisional para la entrada de la línea temporal. */
  tempId: number
  babyId: number
  type: QueuedLogType
  payload: Record<string, unknown>
  queuedAt: string
}

export const OFFLINE_QUEUE_KEY = 'pequedex.offlineQueue'

const ENDPOINTS: Record<QueuedLogType, string> = {
  feed: 'feeds',
  sleep: 'sleeps',
  diaper_change: 'diaper-changes',
  temperature: 'temperatures',
}

export function endpointFor(log: Pick<QueuedLog, 'babyId' | 'type'>): string {
  return `/babies/${log.babyId}/${ENDPOINTS[log.type]}`
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadQueue(storage: KeyValueStorage | null = defaultStorage()): QueuedLog[] {
  try {
    const parsed = JSON.parse(storage?.getItem(OFFLINE_QUEUE_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as QueuedLog[]) : []
  } catch {
    return []
  }
}

export function saveQueue(queue: QueuedLog[], storage: KeyValueStorage | null = defaultStorage()) {
  try {
    storage?.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Sin almacenamiento la cola vive solo hasta recargar.
  }
}

export function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Respaldo para navegadores sin randomUUID (contexto no seguro).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Sin respuesta del servidor (sin red, caída, tiempo agotado) - no un
 * error de validación ni de permisos, que sí traen respuesta. */
export function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { isAxiosError?: boolean; response?: unknown; code?: string }
  return e.isAxiosError === true && e.response === undefined && e.code !== 'ERR_CANCELED'
}

/** La entrada provisional de la línea temporal para un registro en cola,
 * con la misma forma que la que devolvería el servidor. */
export function pendingEntry(log: QueuedLog): TimelineEntry {
  const base = { id: log.tempId, baby_id: log.babyId, user_id: 0, notes: null }
  const p = log.payload
  if (log.type === 'feed') {
    return {
      type: 'feed',
      at: p.started_at as string,
      pending: log.clientUuid,
      data: {
        ...base,
        type: p.type as 'pecho' | 'biberon' | 'solido',
        side: (p.side as 'izquierdo' | 'derecho' | 'ambos' | undefined) ?? null,
        milk_type: (p.milk_type as 'calostro' | 'leche' | undefined) ?? null,
        amount_ml: (p.amount_ml as number | undefined) ?? null,
        started_at: p.started_at as string,
        ended_at: (p.ended_at as string | null | undefined) ?? null,
      },
    }
  }
  if (log.type === 'sleep') {
    return {
      type: 'sleep',
      at: p.started_at as string,
      pending: log.clientUuid,
      data: {
        ...base,
        started_at: p.started_at as string,
        ended_at: (p.ended_at as string | null | undefined) ?? null,
      },
    }
  }
  if (log.type === 'diaper_change') {
    return {
      type: 'diaper_change',
      at: p.changed_at as string,
      pending: log.clientUuid,
      data: {
        ...base,
        changed_at: p.changed_at as string,
        type: p.type as 'mojado' | 'sucio' | 'ambos',
        residue_color: (p.residue_color as never) ?? null,
        size: (p.size as never) ?? null,
      },
    }
  }
  return {
    type: 'temperature',
    at: p.measured_at as string,
    pending: log.clientUuid,
    data: {
      ...base,
      measured_at: p.measured_at as string,
      celsius: p.celsius as number,
      method: (p.method as never) ?? null,
    },
  }
}

/** Añade a una lista de la línea temporal las entradas en cola de ese
 * bebé que todavía no estén (ordenadas por fecha, la más reciente
 * primero, igual que la del servidor). */
export function withPendingEntries(
  timeline: TimelineEntry[],
  queue: QueuedLog[],
  babyId: number,
): TimelineEntry[] {
  const pending = queue
    .filter((log) => log.babyId === babyId)
    .map(pendingEntry)
    .filter((entry) => !timeline.some((e) => e.pending === entry.pending))
  if (pending.length === 0) return timeline
  return [...timeline, ...pending].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )
}
