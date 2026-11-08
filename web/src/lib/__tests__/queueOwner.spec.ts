import { beforeEach, describe, expect, it } from 'vitest'
import { claimQueuesFor, discardAllQueues, QUEUE_OWNER_KEY } from '@/lib/queueOwner'
import { OFFLINE_QUEUE_KEY, OFFLINE_UPDATES_KEY } from '@/lib/offlineQueue'
import { PENDING_WRITES_KEY } from '@/lib/pendingWrites'

function llenarColas() {
  localStorage.setItem(OFFLINE_QUEUE_KEY, '[{"tempId":-1}]')
  localStorage.setItem(OFFLINE_UPDATES_KEY, '[{"targetId":3}]')
  localStorage.setItem(PENDING_WRITES_KEY, '[{"key":"user:sounds"}]')
}

describe('queueOwner', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the queues of the same account, and claims unowned ones', () => {
    llenarColas()

    expect(claimQueuesFor(7)).toBe(false)
    expect(localStorage.getItem(QUEUE_OWNER_KEY)).toBe('7')
    expect(claimQueuesFor(7)).toBe(false)
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).not.toBeNull()
  })

  it("discards another account's queues before anything sends them", () => {
    llenarColas()
    claimQueuesFor(7)

    expect(claimQueuesFor(9)).toBe(true)
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull()
    expect(localStorage.getItem(OFFLINE_UPDATES_KEY)).toBeNull()
    expect(localStorage.getItem(PENDING_WRITES_KEY)).toBeNull()
    expect(localStorage.getItem(QUEUE_OWNER_KEY)).toBe('9')
  })

  it('discards every queue and its owner', () => {
    llenarColas()
    claimQueuesFor(7)

    discardAllQueues()

    for (const key of [
      OFFLINE_QUEUE_KEY,
      OFFLINE_UPDATES_KEY,
      PENDING_WRITES_KEY,
      QUEUE_OWNER_KEY,
    ]) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })
})
