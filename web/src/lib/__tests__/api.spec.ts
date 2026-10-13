import { afterEach, describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/lib/api'
import { i18n } from '@/i18n'

// Captura la petición que saldría, sin tocar la red.
async function sentHeaders() {
  let captured: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = async (config) => {
    captured = config
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  await apiClient.get('/ping')
  return captured!.headers
}

describe('apiClient request headers', () => {
  afterEach(() => {
    i18n.global.locale.value = 'es'
  })

  it('sends the app language so the API answers errors in it', async () => {
    i18n.global.locale.value = 'en'
    expect((await sentHeaders())['Accept-Language']).toBe('en')

    i18n.global.locale.value = 'es'
    expect((await sentHeaders())['Accept-Language']).toBe('es')
  })
})
