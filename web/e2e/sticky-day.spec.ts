import { expect, test } from '@playwright/test'
import { API_URL } from './constants'
import { createSession, signIn } from './session'

// La cabecera de cada día de la línea temporal se queda pegada arriba al bajar
// por sus entradas. Lo comprueba en un Chrome real porque depende del CSS: un
// `overflow-x: hidden` en un contenedor (lo que había en App.vue) anula
// cualquier `position: sticky` de dentro sin dar ningún error.
test('the day header sticks to the top while scrolling through that day', async ({
  page,
  request,
}) => {
  const session = await createSession(request)
  const now = Date.now()
  // Doce cambios de pañal hoy y doce ayer, cada media hora hacia atrás.
  for (let i = 0; i < 24; i++) {
    const changedAt = new Date(now - (i < 12 ? i * 30 : 24 * 60 + i * 30) * 60_000)
    const created = await request.post(`${API_URL}/babies/${session.babyId}/diaper-changes`, {
      data: { type: 'mojado', changed_at: changedAt.toISOString() },
      headers: session.authHeaders,
    })
    expect(created.ok(), await created.text()).toBeTruthy()
  }

  await signIn(page, session)
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('./')
  const headers = page.locator('li.sticky')
  await expect(headers.first()).toBeVisible()
  const firstHeader = headers.first()

  // Se baja hasta la mitad de las entradas de hoy.
  await firstHeader.evaluate((el) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 300)
  })
  await expect
    .poll(() => firstHeader.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
    .toBe(0)

  // Y la página no se puede desplazar en horizontal (lo que evitaba el overflow).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
