import { describe, expect, it } from 'vitest'
import {
  SNAPSHOT_KEY,
  SNAPSHOT_MAX_AGE_MS,
  buildSnapshot,
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  tokenTail,
} from '@/lib/snapshot'
import type { BabiesSnapshotData, Baby } from '@/stores/babies'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const data = { timeline: [], temperatures: [] } as unknown as BabiesSnapshotData
const baby = { id: 2 } as Baby
const NOW = 1_800_000_000_000

describe('snapshot', () => {
  it('round-trips for the same session', () => {
    const storage = memoryStorage()
    saveSnapshot(buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW), storage)

    const loaded = loadSnapshot('token-abcdefghijklmnop', NOW + 1000, storage)

    expect(loaded?.currentId).toBe(2)
    expect(loaded?.babies).toEqual([baby])
  })

  it('does not show a snapshot saved by another session', () => {
    const storage = memoryStorage()
    saveSnapshot(buildSnapshot('token-de-otra-cuenta-xyz', null, [baby], 2, data, NOW), storage)

    expect(loadSnapshot('token-abcdefghijklmnop', NOW, storage)).toBeNull()
  })

  it('needs a token at all', () => {
    const storage = memoryStorage()
    saveSnapshot(buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW), storage)

    expect(loadSnapshot(null, NOW, storage)).toBeNull()
  })

  it('ignores a snapshot that is too old', () => {
    const storage = memoryStorage()
    saveSnapshot(buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW), storage)

    expect(
      loadSnapshot('token-abcdefghijklmnop', NOW + SNAPSHOT_MAX_AGE_MS + 1, storage),
    ).toBeNull()
  })

  it('ignores a corrupt or other-version snapshot', () => {
    const storage = memoryStorage()
    storage.setItem(SNAPSHOT_KEY, '{no es json')
    expect(loadSnapshot('token-abcdefghijklmnop', NOW, storage)).toBeNull()

    storage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        ...buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW),
        v: 99,
      }),
    )
    expect(loadSnapshot('token-abcdefghijklmnop', NOW, storage)).toBeNull()
  })

  it('can be cleared, and never stores the whole token', () => {
    const storage = memoryStorage()
    saveSnapshot(buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW), storage)

    expect(storage.getItem(SNAPSHOT_KEY)).not.toContain('token-abcdefghijklmnop')
    expect(tokenTail('token-abcdefghijklmnop')).toHaveLength(12)

    clearSnapshot(storage)
    expect(loadSnapshot('token-abcdefghijklmnop', NOW, storage)).toBeNull()
  })

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('lleno')
      },
      removeItem: () => {
        throw new Error('bloqueado')
      },
    }

    expect(() =>
      saveSnapshot(buildSnapshot('token-abcdefghijklmnop', null, [baby], 2, data, NOW), broken),
    ).not.toThrow()
    expect(loadSnapshot('token-abcdefghijklmnop', NOW, broken)).toBeNull()
    expect(() => clearSnapshot(broken)).not.toThrow()
  })
})
