import type { Pinia } from 'pinia'
import { buildSnapshot, clearSnapshot, saveSnapshot } from '@/lib/snapshot'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'

/** Tiempo que se espera tras el último cambio antes de guardar la foto:
 * serializar unas decenas de KB en cada cambio de estado no merece la pena. */
export const SNAPSHOT_DEBOUNCE_MS = 1500

/**
 * Mantiene al día la foto del Dashboard (lib/snapshot.ts) mientras se usa
 * la app. No guarda mientras lo que se ve todavía es la foto anterior sin
 * refrescar (`hydratedFromSnapshot`): no hay nada nuevo que guardar y,
 * si el servidor no responde, no se renueva la fecha de algo caducado.
 */
export function startSnapshotSync(pinia: Pinia): void {
  const auth = useAuthStore(pinia)
  const babies = useBabiesStore(pinia)
  let timer: ReturnType<typeof setTimeout> | undefined

  const save = () => {
    if (!auth.token) {
      clearSnapshot()
      return
    }
    if (babies.hydratedFromSnapshot || babies.current === null) return

    saveSnapshot(
      buildSnapshot(auth.token, auth.user, babies.babies, babies.current.id, babies.snapshotData()),
    )
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(save, SNAPSHOT_DEBOUNCE_MS)
  }

  auth.$subscribe(schedule, { detached: true })
  babies.$subscribe(schedule, { detached: true })
}
