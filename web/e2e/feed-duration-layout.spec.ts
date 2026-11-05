import { expect, test, type Locator } from '@playwright/test'
import { createSession, signIn } from './session'

// Las duraciones de una toma al pecho ("Sin indicar" y 5, 10, 15, 20, 30, 45+ min)
// tienen que caber en dos líneas en una pantalla de 360 px, el ancho del móvil
// de uso diario: con más, el formulario se alarga y empuja el botón de guardar.
// Depende del CSS real (anchos de texto, huecos, saltos de línea), así que se mide
// en un Chrome real contando las filas distintas que ocupan los botones.
const SLOW_FIRST_LOAD_MS = 45_000
const OPEN_SHEET = 'div:not([inert]) > [role="dialog"]'

async function rowsOf(group: Locator): Promise<number> {
  return group.locator('button').evaluateAll((buttons) => {
    const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top))
    return new Set(tops).size
  })
}

test('the breast feed durations fit in two lines at 360 px, in the form and in the account', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const session = await createSession(request)
  await signIn(page, session)
  await page.setViewportSize({ width: 360, height: 740 })

  // Formulario "+ Toma": abre con "Pecho" elegido.
  await page.goto('./?atajo=toma')
  const sheet = page.locator(OPEN_SHEET)
  await expect(sheet).toHaveCount(1, { timeout: SLOW_FIRST_LOAD_MS })
  const feedOptions = sheet.getByTestId('feed-duration-options')
  await expect(feedOptions.getByRole('button', { name: '5 min', exact: true })).toBeVisible()
  await expect(feedOptions.getByRole('button')).toHaveCount(7)
  expect(await rowsOf(feedOptions)).toBeLessThanOrEqual(2)

  // "Tu cuenta": la duración por defecto, con las mismas opciones.
  await page.goto('./')
  await page.getByRole('button', { name: 'Tu cuenta' }).click()
  const defaults = page.getByRole('radiogroup', { name: 'Duración de toma al pecho por defecto' })
  await defaults.scrollIntoViewIfNeeded()
  await expect(defaults.getByRole('radio', { name: '5 min', exact: true })).toBeVisible()
  await expect(defaults.getByRole('radio')).toHaveCount(7)
  expect(await rowsOf(defaults)).toBeLessThanOrEqual(2)
})
