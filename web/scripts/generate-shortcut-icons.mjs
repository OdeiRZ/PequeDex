// Genera los iconos de los atajos del icono de la app (public/icons/shortcut-*.png):
// el MISMO dibujo que usa la app para toma, sueño y pañal (src/components/CategoryIcon.vue)
// en blanco sobre el color de cada categoría (src/assets/base.css). Hay que lanzarlo a
// mano si cambian esos dibujos o colores:
//
//   node scripts/generate-shortcut-icons.mjs
//
// Usa el Chrome ya instalado a través de Playwright (el mismo que las pruebas e2e).
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons')
const SIZE = 192

// Colores de --feed, --sleep y --diaper en el tema claro (base.css).
const ICONS = {
  toma: {
    color: '#c98a3e',
    paths: `
      <path stroke-width="2.4" d="M9.5 4h5M10.5 4v2.6L8.5 9.3a2 2 0 0 0-.5 1.3V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8.4a2 2 0 0 0-.5-1.3l-2-2.7V4" />
      <path stroke-width="2" d="M8 13h8" />`,
  },
  sueno: {
    color: '#5b5a8c',
    paths: `
      <path fill="currentColor" stroke="none" d="M21 13.2A9 9 0 1 1 10.8 3a7.2 7.2 0 0 0 10.2 10.2Z" />
      <rect fill="currentColor" stroke="none" x="15.2" y="3.3" width="2.6" height="2.6" rx="0.6" transform="rotate(45 16.5 4.6)" />
      <rect fill="currentColor" stroke="none" x="18.7" y="7.2" width="1.7" height="1.7" rx="0.4" transform="rotate(45 19.55 8.05)" />`,
  },
  panal: {
    color: '#6e9080',
    paths: `
      <rect stroke-width="2.2" x="4" y="6" width="16" height="13" rx="4" />
      <path stroke-width="2.2" d="M14.5 6v2.8a2 2 0 0 0 2 2H20" />`,
  },
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })

for (const [name, { color, paths }] of Object.entries(ICONS)) {
  // Fondo a sangre del color de la categoría (el lanzador lo recorta en círculo o
  // cuadrado redondeado) y el dibujo en blanco, con margen para que no se corte.
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${color}">
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <svg x="42" y="42" width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="#fff"
           color="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>
    </svg></body></html>`)
  const file = path.join(outDir, `shortcut-${name}.png`)
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: SIZE, height: SIZE } })
  console.log('escrito', path.relative(process.cwd(), file), fs.statSync(file).size, 'bytes')
}

await browser.close()
