import { expect, test } from '@playwright/test'
import { createSession, signIn } from './session'

// El resto de tests bloquean el service worker (ver playwright.config.ts);
// este es el que lo prueba de verdad, con el build real.
test.use({ serviceWorkers: 'allow' })

test('the app opens without a connection once it has been visited', async ({
  page,
  context,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  // Primera visita, con red: el service worker se instala y guarda la app.
  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  // La "foto" del Dashboard (lib/snapshot.ts) se guarda un momento después de
  // cargar; sin ella, sin conexión no habría nada que pintar.
  await page.waitForFunction(() => localStorage.getItem('pequedex.snapshot') !== null)

  const cachedFiles = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('pequedex-shell-'))
    const cache = await caches.open(names[0]!)
    return (await cache.keys()).map((request) => new URL(request.url).pathname)
  })
  // El index, los ficheros con hash de la app y los iconos, pero no los audios.
  expect(cachedFiles.some((path) => path.endsWith('/PequeDex/'))).toBe(true)
  expect(cachedFiles.some((path) => /\/assets\/.+\.js$/.test(path))).toBe(true)
  expect(cachedFiles.some((path) => path.endsWith('/icons/icon-192.png'))).toBe(true)
  expect(cachedFiles.some((path) => path.includes('/sounds/'))).toBe(false)

  // Sin conexión: recargar la raíz y abrir un enlace directo a otra pantalla.
  await context.setOffline(true)

  await page.reload()
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()

  await page.goto('./estadisticas')
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.getByText(/ERR_INTERNET_DISCONNECTED/)).toHaveCount(0)
})

test('a visit before the service worker has taken control still works with a connection', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  await signIn(page, session)

  // Sin esperar a nada: la primera carga no depende del service worker.
  await page.goto('./')
  await expect(page.getByText('Bebé E2E').first()).toBeVisible()
})
