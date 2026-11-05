import { expect, test, type Locator } from '@playwright/test'
import { createSession, signIn } from './session'

// Las duraciones de una toma al pecho ("Sin indicar" y 5, 10, 15, 20, 30, 45+ min)
// tienen que caber en dos líneas en el móvil de uso diario (360 px): con más, el
// formulario se alarga y empuja el botón de guardar. El diseño (una cuadrícula de
// 4 columnas, con "Sin indicar" ocupando 2) lo garantiza sea cual sea la letra;
// la prueba lo comprueba midiendo en un Chrome real, con una tipografía ANCHA a
// propósito (Verdana en Windows, DejaVu Sans en el Linux de CI): los botones usan
// la del sistema, que cambia de un equipo a otro, y sin fijarla una prueba que
// pasa en un sitio falla en otro. Además de las filas, exige que ningún texto
// se salga de su botón.
const SLOW_FIRST_LOAD_MS = 45_000
const OPEN_SHEET = 'div:not([inert]) > [role="dialog"]'
const WIDE_FONT = "button { font-family: Verdana, 'DejaVu Sans', sans-serif !important }"

async function layoutOf(group: Locator): Promise<{ rows: number; clipped: string[] }> {
  return group.locator('button').evaluateAll((buttons) => ({
    rows: new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
    clipped: buttons
      .filter((button) => button.scrollWidth > button.clientWidth + 1)
      .map((button) => button.textContent?.trim() ?? ''),
  }))
}

test('the breast feed durations fit in two lines on a phone, in the form and in the account', async ({
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
  await page.addStyleTag({ content: WIDE_FONT })
  const feedOptions = sheet.getByTestId('feed-duration-options')
  await expect(feedOptions.getByRole('button', { name: '5 min', exact: true })).toBeVisible()
  await expect(feedOptions.getByRole('button')).toHaveCount(7)
  expect(await layoutOf(feedOptions)).toEqual({ rows: 2, clipped: [] })

  // "Tu cuenta": la duración por defecto, con las mismas opciones.
  await page.goto('./')
  await page.addStyleTag({ content: WIDE_FONT })
  await page.getByRole('button', { name: 'Tu cuenta' }).click()
  const defaults = page.getByRole('radiogroup', { name: 'Duración de toma al pecho por defecto' })
  await defaults.scrollIntoViewIfNeeded()
  await expect(defaults.getByRole('radio', { name: '5 min', exact: true })).toBeVisible()
  await expect(defaults.getByRole('radio')).toHaveCount(7)
  expect(await layoutOf(defaults)).toEqual({ rows: 2, clipped: [] })
})
