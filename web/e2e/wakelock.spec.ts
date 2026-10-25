import { expect, test } from '@playwright/test'
import { createSession, signIn } from './session'

// Contracciones mantiene la pantalla encendida mientras se cuentan
// (composables/useScreenWakeLock.ts). La API real depende del dispositivo (un
// Chrome sin pantalla puede negarla), así que se sustituye por una que apunta las
// llamadas: lo que se prueba es que la app la pide y la suelta cuando toca.
test('the contractions page keeps the screen on while timing and lets it go on leaving', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const log = { requests: 0, releases: 0 }
    ;(window as unknown as { __wakeLog: typeof log }).__wakeLog = log
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          log.requests += 1
          const sentinel = {
            released: false,
            release: async () => {
              sentinel.released = true
              log.releases += 1
            },
          }
          return sentinel
        },
      },
    })
  })
  const wakeLog = () =>
    page.evaluate(
      () => (window as unknown as { __wakeLog: { requests: number; releases: number } }).__wakeLog,
    )

  const session = await createSession(request)
  await signIn(page, session)
  await page.goto('./contracciones')

  // Sin contracciones: nada que mantener encendido.
  await expect(page.getByRole('button', { name: /Inicio de contracción/ })).toBeVisible()
  expect((await wakeLog()).requests).toBe(0)

  // Al empezar una, se pide.
  await page.getByRole('button', { name: /Inicio de contracción/ }).click()
  await expect.poll(async () => (await wakeLog()).requests).toBe(1)

  // Al terminarla sigue encendida: la siguiente llega en minutos.
  await page.getByRole('button', { name: /Detener/ }).click()
  await expect(page.getByRole('button', { name: /Inicio de contracción/ })).toBeVisible()
  expect(await wakeLog()).toEqual({ requests: 1, releases: 0 })

  // Al salir de la pantalla se suelta.
  await page.evaluate(() =>
    (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $router: { push(to: string): unknown } } } }
      }
    ).__vue_app__.config.globalProperties.$router.push('/'),
  )
  await expect.poll(async () => (await wakeLog()).releases).toBe(1)
})
