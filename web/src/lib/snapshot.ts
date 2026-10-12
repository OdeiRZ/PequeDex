import type { User } from '@/stores/auth'
import type { Baby, BabiesSnapshotData } from '@/stores/babies'

// La última foto del Dashboard, guardada en el propio móvil: al abrir la
// app se pinta al instante y se refresca por detrás. Sin esto, abrir la
// app tras un rato inactiva esperaba al API de Render despertando (~12 s
// medidos) con la pantalla en "cargando". Solo localStorage, sin
// servicios externos. Va ligada al token de la sesión: si inicia sesión
// otra cuenta en el mismo navegador, esta foto no se enseña.

export const SNAPSHOT_KEY = 'pequedex.snapshot'
const SNAPSHOT_VERSION = 1
/** Más viejo que esto ya no se enseña: cuanto más antigua, más engaña. */
export const SNAPSHOT_MAX_AGE_MS = 7 * 86_400_000

export interface Snapshot {
  v: number
  savedAt: number
  /** Final del token de la sesión que la guardó (no el token entero). */
  tokenTail: string
  user: User | null
  babies: Baby[]
  currentId: number | null
  data: BabiesSnapshotData
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function tokenTail(token: string): string {
  return token.slice(-12)
}

export function saveSnapshot(
  snapshot: Snapshot,
  storage: KeyValueStorage | null = defaultStorage(),
): void {
  try {
    storage?.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Cuota llena o sin almacenamiento: la app funciona igual, solo sin foto.
  }
}

export function clearSnapshot(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SNAPSHOT_KEY)
  } catch {
    // nada que limpiar
  }
}

/** La foto guardada, solo si es de esta versión, de esta sesión y reciente. */
export function loadSnapshot(
  token: string | null,
  now: number = Date.now(),
  storage: KeyValueStorage | null = defaultStorage(),
): Snapshot | null {
  if (!token) return null

  try {
    const raw = storage?.getItem(SNAPSHOT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Snapshot
    if (
      parsed.v !== SNAPSHOT_VERSION ||
      parsed.tokenTail !== tokenTail(token) ||
      typeof parsed.savedAt !== 'number' ||
      now - parsed.savedAt > SNAPSHOT_MAX_AGE_MS ||
      !Array.isArray(parsed.babies)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function buildSnapshot(
  token: string,
  user: User | null,
  babies: Baby[],
  currentId: number | null,
  data: BabiesSnapshotData,
  now: number = Date.now(),
): Snapshot {
  return {
    v: SNAPSHOT_VERSION,
    savedAt: now,
    tokenTail: tokenTail(token),
    user,
    babies,
    currentId,
    data,
  }
}
