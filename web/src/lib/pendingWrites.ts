// Cambios pendientes de enviar sobre cosas que ya existen en el servidor:
// las opciones de la cuenta, los ajustes del bebé, la vitamina D, y editar o
// borrar una medida, una vacuna o una revisión. Se guardan en el propio móvil
// (localStorage) y se envían solos al volver la conexión, igual que la cola de
// tomas, sueños y pañales (lib/offlineQueue.ts), pero más simple: ninguno crea
// nada nuevo, así que no hace falta un identificador para no duplicar.
//
// Uno por `key`: si se cambia dos veces lo mismo sin conexión (p. ej. un
// interruptor), solo importa el último valor, y es el que se envía.

export interface PendingWrite {
  /** Único por escritura: distingue dos cambios seguidos sobre la misma `key`. */
  id: string
  /** Qué se está cambiando ("user:/user/alerts", "growth:12"...): el último gana. */
  key: string
  method: 'put' | 'delete'
  url: string
  body?: unknown
  queuedAt: string
}

export const PENDING_WRITES_KEY = 'pequedex.pendingWrites'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadWrites(storage: KeyValueStorage | null = defaultStorage()): PendingWrite[] {
  try {
    const parsed = JSON.parse(storage?.getItem(PENDING_WRITES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveWrites(
  writes: PendingWrite[],
  storage: KeyValueStorage | null = defaultStorage(),
): void {
  try {
    if (writes.length === 0) storage?.removeItem(PENDING_WRITES_KEY)
    else storage?.setItem(PENDING_WRITES_KEY, JSON.stringify(writes))
  } catch {
    // Sin almacenamiento o cuota llena: se envía igual mientras la app siga abierta.
  }
}

/** La lista con `write` en lugar de lo que hubiera con su misma `key`. */
export function upsertWrite(list: PendingWrite[], write: PendingWrite): PendingWrite[] {
  return [...list.filter((existing) => existing.key !== write.key), write]
}
