import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useToastStore } from '@/stores/toast'

describe('toast store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a message and clears it automatically after a few seconds', () => {
    const toast = useToastStore()

    toast.show('Eliminado.')
    expect(toast.message).toBe('Eliminado.')

    vi.advanceTimersByTime(3000)
    expect(toast.message).toBeNull()
  })

  it('replaces the current message and restarts the timer instead of queuing', () => {
    const toast = useToastStore()

    toast.show('Eliminado.')
    vi.advanceTimersByTime(2000)

    toast.show('Guardado.')
    expect(toast.message).toBe('Guardado.')

    // The first call's timer would have fired here if it hadn't been
    // cleared - message must still be the second one, not null.
    vi.advanceTimersByTime(1000)
    expect(toast.message).toBe('Guardado.')

    vi.advanceTimersByTime(2000)
    expect(toast.message).toBeNull()
  })
})
