import type { TimelineEntry } from '@/stores/babies'

// Registro sin conexión: si al crear una toma, un sueño, un pañal o una
// temperatura no hay red, el registro se guarda en esta cola (en el
// propio móvil, localStorage - unos pocos KB, sin servicios externos) y
// se envía solo al volver la conexión. Cada uno lleva un `client_uuid`
// generado aquí: si un envío llega al servidor pero la respuesta se
// pierde, el reintento no lo duplica (ver CreatesIdempotently en la API).
// Además de crear, se puede "Finalizar" sin conexión un sueño o una toma
// ya guardados (QueuedUpdate): se reenvía como PUT al volver la red.
// Editar o borrar en general sigue necesitando conexión.

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
export const OFFLINE_UPDATES_KEY = 'pequedex.offlineUpdates'

/** Cambio pendiente sobre un registro ya guardado en el servidor
 * (p.ej. finalizar un sueño en curso): el PUT completo, listo para enviar. */
export interface QueuedUpdate {
  babyId: number
  type: 'feed' | 'sleep'
  targetId: number
  payload: Record<string, unknown>
  queuedAt: string
}

const ENDPOINTS: Record<QueuedLogType, string> = {
  feed: 'feeds',
  sleep: 'sleeps',
  diaper_change: 'diaper-changes',
  temperature: 'temperatures',
}

export function endpointFor(log: Pick<QueuedLog, 'babyId' | 'type'>): string {
  return `/babies/${log.babyId}/${ENDPOINTS[log.type]}`
}

export function updateEndpoint(update: Pick<QueuedUpdate, 'babyId' | 'type' | 'targetId'>): string {
  return `/babies/${update.babyId}/${ENDPOINTS[update.type]}/${update.targetId}`
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

export function loadUpdates(storage: KeyValueStorage | null = defaultStorage()): QueuedUpdate[] {
  try {
    const parsed = JSON.parse(storage?.getItem(OFFLINE_UPDATES_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as QueuedUpdate[]) : []
  } catch {
    return []
  }
}

export function saveUpdates(
  updates: QueuedUpdate[],
  storage: KeyValueStorage | null = defaultStorage(),
) {
  try {
    storage?.setItem(OFFLINE_UPDATES_KEY, JSON.stringify(updates))
  } catch {
    // Sin almacenamiento la cola vive solo hasta recargar.
  }
}

/** Aplica a una lista de la línea temporal los cambios pendientes de ese
 * bebé (p.ej. un sueño ya finalizado sin conexión), para que el sondeo
 * no los deshaga antes de enviarse. */
export function withPendingUpdates(
  timeline: TimelineEntry[],
  updates: QueuedUpdate[],
  babyId: number,
): TimelineEntry[] {
  const mine = updates.filter((u) => u.babyId === babyId)
  if (mine.length === 0) return timeline
  return timeline.map((entry) => {
    if (entry.type !== 'feed' && entry.type !== 'sleep') return entry
    const update = mine.find((u) => u.type === entry.type && u.targetId === entry.data.id)
    if (!update) return entry
    return { ...entry, data: { ...entry.data, ...update.payload } } as TimelineEntry
  })
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
