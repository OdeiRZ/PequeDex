import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/vue'
import { filterEvent } from '@/lib/errorReporting'

function eventWith(message: string, extra: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, exception: { values: [{ type: 'Error', value: message }] }, ...extra }
}

describe('filterEvent', () => {
  it.each([
    'Network Error',
    'timeout of 7000ms exceeded',
    'timeout of 45000ms exceeded',
    'Failed to fetch',
    'Load failed',
    'ResizeObserver loop completed with undelivered notifications.',
  ])('drops the everyday noise: %s', (message) => {
    expect(filterEvent(eventWith(message), { originalException: new Error(message) })).toBeNull()
  })

  it('keeps a real error', () => {
    const event = eventWith("Cannot read properties of undefined (reading 'id')")

    expect(filterEvent(event, { originalException: new TypeError('x is undefined') })).toBe(event)
  })

  it('keeps an HTTP error that had a response (it is not a network failure)', () => {
    const message = 'Request failed with status code 500'

    expect(
      filterEvent(eventWith(message), { originalException: new Error(message) }),
    ).not.toBeNull()
  })

  it('removes the user and the URL query so no personal data is sent', () => {
    const event = eventWith('boom', {
      user: { id: '7', email: 'odei@example.com' },
      request: {
        url: 'https://odeirz.github.io/PequeDex/reset-password?token=secreto&email=odei@example.com',
        query_string: 'token=secreto',
        cookies: { a: 'b' },
      },
    })

    const result = filterEvent(event)!

    expect(result.user).toBeUndefined()
    expect(result.request?.url).toBe('https://odeirz.github.io/PequeDex/reset-password')
    expect(result.request?.query_string).toBeUndefined()
    expect(result.request?.cookies).toBeUndefined()
  })
})
