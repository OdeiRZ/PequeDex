import { test, expect, type Route } from '@playwright/test'
import { API_URL } from './constants'
import { createSession, signIn } from './session'

// Cuánto tarda en sincronizarse lo pendiente DESDE QUE LA RED VUELVE. Es lo que
// se nota en la cama con el bebé: la conexión ya funciona y la app sigue
// diciendo "pendiente de enviar". Se mide con el reloj de la propia prueba.

async function ongoingSleep(request: Parameters<typeof createSession>[0]) {
  const session = await createSession(request)
  const started = new Date(Date.now() - 20 * 60_000).toISOString()
  const created = await request.post(`${API_URL}/babies/${session.babyId}/sleeps`, {
    data: { started_at: started, ended_at: null },
    headers: session.authHeaders,
  })
  expect(created.ok()).toBeTruthy()
  return session
}

test.setTimeout(120_000)

test('a pending change syncs soon after the connection comes back (hanging network)', async ({
  page,
  request,
}) => {
  const session = await ongoingSleep(request)
  await signIn(page, session)
  await page.goto('./')
  const finish = page.getByRole('button', { name: 'Finalizar' })
  await expect(finish).toBeVisible()

  // Red colgada: ninguna petición al API contesta ni falla, y las que ya están
  // colgadas SIGUEN colgadas cuando la red vuelve (como un TCP que se quedó
  // muerto): solo las peticiones nuevas pasan.
  let dead = true
  const handler = (route: Route) =>
    dead ? new Promise<void>(() => {}) : route.continue().catch(() => {})
  await page.route(`${API_URL}/**`, handler)
  await page.route('**/up', handler)
  await finish.click()
  await expect(page.getByText(/pendiente de enviar/)).toBeVisible({ timeout: 3_000 })

  // Se deja pasar un rato con la red muerta, como en la vida real, para que el
  // envío en segundo plano esté ya colgado cuando vuelva.
  await page.waitForTimeout(6_000)

  dead = false
  const backAt = Date.now()
  await expect(page.getByText(/pendiente de enviar/)).toBeHidden({ timeout: 90_000 })
  const seconds = (Date.now() - backAt) / 1000
  console.log(`RECONNECT_SECONDS=${seconds.toFixed(1)}`)

  // Presupuesto: antes de este cambio tardaba hasta ~35 s (envío colgado 20 s +
  // sondeo de 15 s). Con reintentos cortos y la petición colgada cancelada,
  // debe sincronizar en pocos segundos.
  expect(seconds).toBeLessThan(12)
})
