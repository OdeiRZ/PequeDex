import { describe, it, expect } from 'vitest'
import {
  endpointFor,
  isNetworkError,
  loadQueue,
  pendingEntry,
  saveQueue,
  withPendingEntries,
  type QueuedLog,
} from '@/lib/offlineQueue'
import type { TimelineEntry } from '@/stores/babies'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

function log(overrides: Partial<QueuedLog> = {}): QueuedLog {
  return {
    clientUuid: 'uuid-1',
    tempId: -1,
    babyId: 7,
    type: 'diaper_change',
    payload: { changed_at: '2026-10-12T08:00:00Z', type: 'mojado' },
    queuedAt: '2026-10-12T08:00:00Z',
    ...overrides,
  }
}

describe('offline queue persistence', () => {
  it('saves and loads the queue, and survives garbage', () => {
    const storage = memoryStorage()
    saveQueue([log()], storage)
    expect(loadQueue(storage)).toEqual([log()])

    storage.setItem('pequedex.offlineQueue', 'not json')
    expect(loadQueue(storage)).toEqual([])
    expect(loadQueue(null)).toEqual([])
  })
})

describe('isNetworkError', () => {
  it('is true only for axios errors without a response', () => {
    expect(isNetworkError({ isAxiosError: true, code: 'ERR_NETWORK' })).toBe(true)
    expect(isNetworkError({ isAxiosError: true, code: 'ECONNABORTED' })).toBe(true)
    expect(isNetworkError({ isAxiosError: true, response: { status: 422 } })).toBe(false)
    expect(isNetworkError({ isAxiosError: true, code: 'ERR_CANCELED' })).toBe(false)
    expect(isNetworkError(new Error('boom'))).toBe(false)
  })
})

describe('pending entries', () => {
  it('builds a timeline entry shaped like the server one, flagged as pending', () => {
    const entry = pendingEntry(
      log({ type: 'sleep', payload: { started_at: '2026-10-12T07:00:00Z', ended_at: null } }),
    )
    expect(entry).toMatchObject({
      type: 'sleep',
      at: '2026-10-12T07:00:00Z',
      pending: 'uuid-1',
      data: { id: -1, baby_id: 7, started_at: '2026-10-12T07:00:00Z', ended_at: null },
    })
  })

  it('re-adds the current baby queued entries to a fresh server timeline, newest first', () => {
    const server: TimelineEntry[] = [
      pendingEntry(
        log({ clientUuid: 'x', payload: { changed_at: '2026-10-12T09:00:00Z', type: 'sucio' } }),
      ),
    ].map((e) => ({ ...e, pending: undefined }))
    const merged = withPendingEntries(
      server,
      [log(), log({ clientUuid: 'other-baby', babyId: 99 })],
      7,
    )
    expect(merged.map((e) => e.pending ?? 'server')).toEqual(['server', 'uuid-1'])
  })

  it('builds the endpoint for each type', () => {
    expect(endpointFor({ babyId: 7, type: 'diaper_change' })).toBe('/babies/7/diaper-changes')
    expect(endpointFor({ babyId: 7, type: 'temperature' })).toBe('/babies/7/temperatures')
  })
})
