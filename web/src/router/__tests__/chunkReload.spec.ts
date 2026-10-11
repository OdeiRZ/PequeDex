import { describe, it, expect } from 'vitest'
import { shouldReloadAfterChunkError } from '@/router'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const chunkError =
  'Failed to fetch dynamically imported module: https://x/assets/VaccinationsView-abc.js'

describe('shouldReloadAfterChunkError', () => {
  it('reloads when a lazy page fails to download', () => {
    expect(shouldReloadAfterChunkError(chunkError, '/vacunas', memoryStorage())).toBe(true)
  })

  it('ignores any other navigation error', () => {
    expect(shouldReloadAfterChunkError('Navigation cancelled', '/vacunas', memoryStorage())).toBe(
      false,
    )
  })

  it('does not reload the same page twice within a minute (no loop)', () => {
    const storage = memoryStorage()
    expect(shouldReloadAfterChunkError(chunkError, '/vacunas', storage, 1_000)).toBe(true)
    expect(shouldReloadAfterChunkError(chunkError, '/vacunas', storage, 30_000)).toBe(false)
    expect(shouldReloadAfterChunkError(chunkError, '/vacunas', storage, 70_000)).toBe(true)
  })

  it('still reloads without storage', () => {
    expect(shouldReloadAfterChunkError(chunkError, '/vacunas', null)).toBe(true)
  })
})
