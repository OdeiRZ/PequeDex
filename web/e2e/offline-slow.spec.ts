import { test, expect } from '@playwright/test'
import { API_URL } from './constants'
import { createSession, signIn } from './session'

// El modo sin conexión con una red que NO falla al instante: wifi sin internet,
// datos sin cobertura, la API de Render despertando. Es lo que pasa de verdad en
// la cama con el bebé, y lo que los tests de "context.setOffline(true)" (corte
// instantáneo) no cubrían: la pantalla se quedaba ~7 s con el botón activo y sin
// ningún aviso antes de pasar a "pendiente de enviar".

/** La pantalla debe responder en un par de segundos aunque la red no conteste. */
const RESPONDS_WITHIN_MS = 3_000

async function ongoingSleep(request: Parameters<typeof createSession>[0]) {
  const session = await createSession(request)
  const started = new Date(Date.now() - 20 * 60_000).toISOString()
  const created = await request.post(`${API_URL}/babies/${session.babyId}/sleeps`, {
    data: { started_at: started, ended_at: null },
    headers: session.authHeaders,
  })
  expect(created.ok()).toBeTruthy()
  return { session, sleepId: (await created.json()).data.id as number }
}

test.setTimeout(120_000)

test('finishing a sleep responds at once when the connection hangs, and syncs when it comes back', async ({
  page,
  request,
}) => {
  const { session, sleepId } = await ongoingSleep(request)
  await signIn(page, session)
  await page.goto('./')
  const finish = page.getByRole('button', { name: 'Finalizar' })
  await expect(finish).toBeVisible()

  // Toda petición al API se queda esperando, sin responder ni fallar.
  await page.route(`${API_URL}/**`, () => new Promise(() => {}))

  const clickedAt = Date.now()
  await finish.click()

  // El botón desaparece y avisa de que queda pendiente, sin esperar a la red.
  await expect(page.getByRole('button', { name: 'Finalizar' })).toHaveCount(0, {
    timeout: RESPONDS_WITHIN_MS,
  })
  await expect(page.getByText(/pendiente de enviar/)).toBeVisible({ timeout: RESPONDS_WITHIN_MS })
  expect(Date.now() - clickedAt).toBeLessThan(RESPONDS_WITHIN_MS + 1_000)

  // Vuelve la conexión: lo pendiente se envía solo (las peticiones colgadas se
  // sueltan a los 20 s y el siguiente sondeo lo reenvía).
  await page.unroute(`${API_URL}/**`)
  await expect(page.getByText(/pendiente de enviar/)).toBeHidden({ timeout: 90_000 })

  const sleeps = await request.get(`${API_URL}/babies/${session.babyId}/sleeps`, {
    headers: session.authHeaders,
  })
  const saved = (await sleeps.json()).data.find((s: { id: number }) => s.id === sleepId)
  expect(saved.ended_at).not.toBeNull()
})

test('finishing a sleep with a slow API (cold start) responds at once and is saved once, without duplicates', async ({
  page,
  request,
}) => {
  const { session, sleepId } = await ongoingSleep(request)
  await signIn(page, session)
  await page.goto('./')
  const finish = page.getByRole('button', { name: 'Finalizar' })
  await expect(finish).toBeVisible()

  // La API tarda 6 s en contestar (despertando), pero acaba contestando.
  await page.route(`${API_URL}/**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6_000))
    await route.continue().catch(() => {})
  })

  await finish.click()
  await expect(page.getByRole('button', { name: 'Finalizar' })).toHaveCount(0, {
    timeout: RESPONDS_WITHIN_MS,
  })
  await expect(page.getByText(/pendiente de enviar/)).toBeVisible({ timeout: RESPONDS_WITHIN_MS })

  // Al contestar la API, lo pendiente desaparece solo.
  await expect(page.getByText(/pendiente de enviar/)).toBeHidden({ timeout: 30_000 })
  await page.unroute(`${API_URL}/**`)

  const sleeps = await request.get(`${API_URL}/babies/${session.babyId}/sleeps`, {
    headers: session.authHeaders,
  })
  const rows = (await sleeps.json()).data as { id: number; ended_at: string | null }[]
  expect(rows).toHaveLength(1)
  expect(rows.find((s) => s.id === sleepId)?.ended_at).not.toBeNull()
})
