import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL } from './constants'

// Cada test crea su propio usuario y bebé por la API (más rápido y estable que
// pasar por los formularios) e inyecta la sesión en el navegador, como si ya
// estuviera iniciada. Lo que se prueba por la interfaz es lo que importa.

export interface Session {
  token: string
  babyId: number
  authHeaders: { Authorization: string; Accept: string }
}

let counter = 0

export async function createSession(request: APIRequestContext): Promise<Session> {
  counter += 1
  const email = `e2e-${Date.now()}-${counter}@example.test`

  const registered = await request.post(`${API_URL}/register`, {
    data: {
      name: 'Cuidador E2E',
      email,
      password: 'prueba-e2e-123',
      password_confirmation: 'prueba-e2e-123',
    },
    headers: { Accept: 'application/json' },
  })
  expect(registered.ok(), await registered.text()).toBeTruthy()
  const { token } = await registered.json()

  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const birth = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const created = await request.post(`${API_URL}/babies`, {
    data: { name: 'Bebé E2E', birth_date: birth },
    headers: authHeaders,
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const babyId = (await created.json()).data.id

  return { token, babyId, authHeaders }
}

export async function signIn(page: Page, session: Session) {
  await page.addInitScript(
    ([token, babyId]) => {
      localStorage.setItem('pequedex_token', token)
      localStorage.setItem('pequedex_active_baby', babyId)
      localStorage.setItem('pequedex_locale', 'es')
    },
    [session.token, String(session.babyId)],
  )
}
