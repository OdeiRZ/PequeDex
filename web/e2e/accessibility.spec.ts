import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createSession, signIn } from './session'

// Accesibilidad (WCAG 2.1 AA) de las pantallas principales y de las hojas que
// más se usan, en tema claro y oscuro, con axe en un Chrome real. La auditoría
// del 2026-11-08 encontró a mano contrastes insuficientes que ninguna prueba
// veía; esta los habría parado. Si falla, el mensaje dice qué regla, dónde y
// con qué colores.
const SLOW_FIRST_LOAD_MS = 45_000
const OPEN_SHEET = 'div:not([inert]) > [role="dialog"]'
// Sin transiciones ni animaciones: axe tiene que medir los colores finales, no
// los de mitad de un fundido (la CI, más lenta, llegó a medir un botón a medio
// cambiar de color justo al abrirse "Tu cuenta").
const NO_MOTION =
  '*, *::before, *::after { transition: none !important; animation: none !important; }'
const SCREENS = ['./', './estadisticas', './vacunas', './contracciones', './sonidos']

// Con una hoja abierta, solo la hoja: lo de detrás está atenuado e inerte.
async function violations(page: Page, only?: string): Promise<string[]> {
  await page.addStyleTag({ content: NO_MOTION })
  const builder = new AxeBuilder({ page })
  if (only) builder.include(only)
  const result = await builder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()

  return result.violations.flatMap((violation) =>
    violation.nodes.map((node) => {
      const data = node.any[0]?.data as
        { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined
      const colors = data?.fgColor
        ? ` (${data.fgColor} sobre ${data.bgColor} = ${data.contrastRatio})`
        : ''
      return `${violation.id}: ${node.target.join(' ')}${colors}`
    }),
  )
}

for (const scheme of ['light', 'dark'] as const) {
  test(`main screens and sheets pass axe in the ${scheme} theme`, async ({ page, request }) => {
    test.setTimeout(150_000)
    const session = await createSession(request)
    await signIn(page, session)
    await page.emulateMedia({ colorScheme: scheme })

    const found: string[] = []
    const check = async (where: string, only?: string) => {
      found.push(...(await violations(page, only)).map((v) => `${where} → ${v}`))
    }

    for (const screen of SCREENS) {
      await page.goto(screen)
      await expect(page.locator('main')).toBeVisible({ timeout: SLOW_FIRST_LOAD_MS })
      await page.waitForLoadState('networkidle')
      await check(screen)
    }

    await page.goto('./?atajo=toma')
    await expect(page.locator(OPEN_SHEET)).toHaveCount(1, {
      timeout: SLOW_FIRST_LOAD_MS,
    })
    await check('hoja "+ Toma"', OPEN_SHEET)

    await page.goto('./')
    await page.getByRole('button', { name: 'Tu cuenta' }).click()
    await expect(page.locator(OPEN_SHEET)).toHaveCount(1)
    await check('"Tu cuenta"', OPEN_SHEET)

    expect(found).toEqual([])
  })
}
