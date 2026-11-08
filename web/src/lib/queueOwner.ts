// De quién son las colas de cambios sin enviar (lib/offlineQueue.ts y
// lib/pendingWrites.ts). Las colas viven en localStorage y no llevan cuenta
// propia: sin esto, si en el mismo móvil entraba otra cuenta, se le enviaban
// como suyos los registros pendientes de la anterior (o se perdían con un 403).
//
// - Al iniciar sesión, o al recuperar el usuario, la cuenta "reclama" las
//   colas: si eran de otra, se descartan antes de que nada las envíe.
// - Al cerrar sesión a propósito se descartan (después de avisar si había
//   algo sin enviar, ver AppHeader): no quedan datos en un móvil compartido.
// - Si la sesión caduca sola (401) se conservan: al volver a entrar la misma
//   persona, se envían como siempre.
import { OFFLINE_QUEUE_KEY, OFFLINE_UPDATES_KEY } from '@/lib/offlineQueue'
import { PENDING_WRITES_KEY } from '@/lib/pendingWrites'

export const QUEUE_OWNER_KEY = 'pequedex.queueOwner'

const QUEUE_KEYS = [OFFLINE_QUEUE_KEY, OFFLINE_UPDATES_KEY, PENDING_WRITES_KEY]

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Marca las colas como de `userId`. Devuelve true si eran de otra cuenta y
 * se han descartado (quien llama recarga entonces sus stores). */
export function claimQueuesFor(userId: number): boolean {
  const store = storage()
  if (!store) return false

  try {
    const owner = store.getItem(QUEUE_OWNER_KEY)
    let discarded = false
    if (owner !== null && owner !== String(userId)) {
      QUEUE_KEYS.forEach((key) => store.removeItem(key))
      discarded = true
    }
    store.setItem(QUEUE_OWNER_KEY, String(userId))
    return discarded
  } catch {
    return false
  }
}

/** Borra todas las colas y su dueño (cerrar sesión a propósito, borrar cuenta). */
export function discardAllQueues() {
  const store = storage()
  try {
    ;[...QUEUE_KEYS, QUEUE_OWNER_KEY].forEach((key) => store?.removeItem(key))
  } catch {
    // Sin almacenamiento no hay nada guardado que borrar.
  }
}
