import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Los atajos del icono de la app instalada (`shortcuts`): cada uno con SU icono
// (los mismos dibujos que la app usa para toma, sueño y pañal), que existe, y todos
// dentro del ámbito de la app. Un icono repetido en los tres es justo lo que se
// vio en el móvil la primera vez.
const publicDir = path.resolve(__dirname, '../../../public')
const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
  id: string
  start_url: string
  scope: string
  shortcuts: { name: string; url: string; icons: { src: string }[] }[]
}

describe('manifest shortcuts', () => {
  // El `id` fija la identidad de la app instalada (con el mismo valor que la
  // dirección de inicio, que es el que Chrome deduce si falta, para no crear
  // una app nueva) y hace que Android regenere los atajos al cambiar el manifiesto.
  it('has an explicit id equal to the start URL', () => {
    expect(manifest.id).toBe(manifest.start_url)
  })

  it('offers the three quick logs, inside the app scope', () => {
    expect(
      manifest.shortcuts.map((s) => new URL(s.url, 'https://x.test').searchParams.get('atajo')),
    ).toEqual(['toma', 'sueno', 'panal'])
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.url.startsWith(manifest.scope)).toBe(true)
    }
  })

  it('gives each one its own icon, and the files exist', () => {
    const icons = manifest.shortcuts.map((s) => s.icons[0]!.src)

    expect(new Set(icons).size).toBe(3)
    for (const src of icons) {
      expect(existsSync(path.join(publicDir, src.replace(manifest.scope, '')))).toBe(true)
    }
  })
})
