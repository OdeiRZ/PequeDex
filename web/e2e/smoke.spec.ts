import { expect, test } from '@playwright/test'
import { API_URL } from './constants'
import { createSession, signIn } from './session'

test('the dashboard loads everything with a single bootstrap request', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  const apiCalls: string[] = []
  page.on('request', (req) => {
    if (req.url().startsWith(API_URL)) apiCalls.push(new URL(req.url()).pathname)
  })

  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()

  const babyCalls = apiCalls.filter((path) => path.includes(`/babies/${session.babyId}/`))
  expect(babyCalls.filter((path) => path.endsWith('/bootstrap'))).toHaveLength(1)
  // Nada de las peticiones sueltas de antes.
  for (const separate of ['timeline', 'milestones', 'sleep-prediction', 'feed-prediction']) {
    expect(babyCalls.filter((path) => path.endsWith(`/${separate}`))).toHaveLength(0)
  }
})

test('navigating between pages leaves a single <main> and breaks no CSP rule', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  const violations: string[] = []
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text())
  })

  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()

  // Navegación del router (sin recargar): antes, cada cambio de ruta dejaba la
  // vista anterior montada y se acumulaban <main> en el DOM.
  for (const route of ['/estadisticas', '/sonidos', '/contracciones', '/', '/estadisticas']) {
    await page.evaluate(
      (to) =>
        (
          document.querySelector('#app') as unknown as {
            __vue_app__: {
              config: { globalProperties: { $router: { push(to: string): unknown } } }
            }
          }
        ).__vue_app__.config.globalProperties.$router.push(to),
      route,
    )
    await expect(page.locator('main')).toHaveCount(1)
  }

  expect(violations).toEqual([])
})

test('reopening with nothing new asks for the dashboard in parallel and gets a 304', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  // Primera visita: respuesta completa, que deja la foto guardada con su huella.
  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem('pequedex.snapshot')
      return raw !== null && JSON.parse(raw).data.bootstrapEtag
    },
    null,
    { timeout: 10_000 },
  )

  const sent: Record<string, number> = {}
  const received: Record<string, { at: number; status: number }> = {}
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname
    if (path.endsWith('/bootstrap')) sent.bootstrap = Date.now()
    if (path.endsWith('/api/babies')) sent.babies = Date.now()
  })
  page.on('response', (res) => {
    const path = new URL(res.url()).pathname
    if (path.endsWith('/bootstrap')) received.bootstrap = { at: Date.now(), status: res.status() }
    if (path.endsWith('/api/babies')) received.babies = { at: Date.now(), status: res.status() }
  })

  await page.reload()
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
  await expect.poll(() => received.bootstrap?.status).toBe(304)

  // En paralelo: la petición grande salió antes de que terminara la de los bebés.
  expect(sent.bootstrap).toBeLessThanOrEqual(received.babies!.at)
  // Y con 304 la foto ya era lo último: sin aviso de "datos guardados".
  await expect(page.getByText('Mostrando lo último guardado')).toHaveCount(0)
  expect(page.url()).not.toMatch(/bienvenida|login/)
})

test('opening the app while the API fails does not log the user out', async ({ page, request }) => {
  const session = await createSession(request)
  await signIn(page, session)

  // El servidor "despertando": errores 503 en todo lo del API.
  await page.route(`${API_URL}/**`, (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"waking"}' }),
  )

  await page.goto('./')
  await expect(page.getByText('No se ha podido cargar')).toBeVisible()

  // La sesión sigue: ni a la pantalla de entrada, ni el token borrado.
  await page.waitForTimeout(1500)
  expect(page.url()).not.toMatch(/bienvenida|login/)
  expect(await page.evaluate(() => localStorage.getItem('pequedex_token'))).toBe(session.token)
})

test('shows the last saved snapshot when the API is down on the next visit', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
  // La foto se guarda con un retraso de 1,5 s tras el último cambio.
  await page.waitForFunction(() => localStorage.getItem('pequedex.snapshot') !== null, null, {
    timeout: 10_000,
  })

  await page.route(`${API_URL}/**`, (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  )
  await page.reload()

  // Se pinta lo guardado, con su aviso, en vez de la pantalla de error.
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
  await expect(page.getByText('Mostrando lo último guardado')).toBeVisible()
  await expect(page.getByText('No se ha podido cargar')).toHaveCount(0)
  expect(page.url()).not.toMatch(/bienvenida|login/)
})

test('finishing an ongoing sleep offline is queued and sent when the connection returns', async ({
  page,
  context,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  // Un sueño en curso, ya guardado en el servidor.
  const started = new Date(Date.now() - 20 * 60_000).toISOString()
  const sleep = await request.post(`${API_URL}/babies/${session.babyId}/sleeps`, {
    data: { started_at: started, ended_at: null },
    headers: session.authHeaders,
  })
  expect(sleep.ok()).toBeTruthy()
  const sleepId = (await sleep.json()).data.id

  await page.goto('./')
  const finish = page.getByRole('button', { name: 'Finalizar' })
  await expect(finish).toBeVisible()

  // Sin conexión (el navegador sigue abierto): finalizar no falla, se encola.
  await context.setOffline(true)
  await finish.click()
  await expect(page.getByText('guardado en el móvil').first()).toBeVisible()
  await expect(page.getByText(/pendiente de enviar/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalizar' })).toHaveCount(0)

  // Vuelve la conexión: se envía solo y el aviso desaparece.
  await context.setOffline(false)
  await expect(page.getByText(/pendiente de enviar/)).toBeHidden()

  const sleeps = await request.get(`${API_URL}/babies/${session.babyId}/sleeps`, {
    headers: session.authHeaders,
  })
  const saved = (await sleeps.json()).data.find((s: { id: number }) => s.id === sleepId)
  expect(saved.ended_at).not.toBeNull()
})

test('deleting an entry offline is queued and applied when the connection returns', async ({
  page,
  context,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  const diaper = await request.post(`${API_URL}/babies/${session.babyId}/diaper-changes`, {
    data: { changed_at: new Date(Date.now() - 10 * 60_000).toISOString(), type: 'mojado' },
    headers: session.authHeaders,
  })
  expect(diaper.ok()).toBeTruthy()

  await page.goto('./')
  // Dentro de <main> (la línea temporal): las hojas inferiores (p. ej. "Eliminar
  // mi cuenta" en Tu cuenta) viven fuera, en el <body>.
  const deleteButton = page
    .locator('main')
    .getByRole('button', { name: /borrar|eliminar/i })
    .first()
  await expect(deleteButton).toBeVisible()

  await context.setOffline(true)
  await deleteButton.click()
  await expect(page.getByText(/pendiente de enviar/)).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText(/pendiente de enviar/)).toBeHidden()

  const after = await request.get(`${API_URL}/babies/${session.babyId}/diaper-changes`, {
    headers: session.authHeaders,
  })
  expect((await after.json()).data).toHaveLength(0)
})

// Atajos del icono de la app instalada (manifest.webmanifest > shortcuts): abren
// el formulario de registro rápido y dejan la URL limpia. El primer pintado del
// Dashboard con el API de pruebas recién arrancado tarda varios segundos (más en
// CI): de ahí los tiempos de espera largos.
const SLOW_FIRST_LOAD_MS = 45_000
// Las hojas inferiores están siempre en el DOM; las cerradas van con `inert`.
const OPEN_SHEET = 'div:not([inert]) > [role="dialog"]'

for (const [shortcut, marker] of [
  ['toma', 'Biberón'],
  ['sueno', 'Empieza'],
  ['panal', 'Mojado'],
] as const) {
  test(`the "${shortcut}" home-screen shortcut opens its quick log form and cleans the URL`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000)
    const session = await createSession(request)
    await signIn(page, session)
    const openSheet = page.locator(OPEN_SHEET)

    await page.goto(`./?atajo=${shortcut}`)

    await expect(openSheet).toHaveCount(1, { timeout: SLOW_FIRST_LOAD_MS })
    await expect(openSheet.getByText(marker).first()).toBeVisible()
    expect(page.url()).not.toContain('atajo')
  })
}

test('an unknown home-screen shortcut is ignored: the dashboard opens with no form', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const session = await createSession(request)
  await signIn(page, session)

  await page.goto('./?atajo=desconocido')

  // Con el Dashboard ya cargado, ningún formulario abierto.
  await expect(page.getByRole('heading', { name: 'Resumen del día' })).toBeAttached({
    timeout: SLOW_FIRST_LOAD_MS,
  })
  await expect(page.locator(OPEN_SHEET)).toHaveCount(0)
  expect(page.url()).not.toContain('atajo')
})
