import { defineConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { API_PORT, API_URL, APP_URL, WEB_PORT } from './e2e/constants'

const webDir = path.dirname(fileURLToPath(import.meta.url))

// Prueba de humo de principio a fin: la app real (build de producción) contra
// el API real de Laravel con una SQLite desechable. Los tests unitarios no
// ejercitan el conjunto, y fallos como "abrir la app sin conexión cierra la
// sesión" solo se ven así. Ver e2e/README o el apartado de pruebas del README.
//
// SEGURIDAD: el API arranca con DB_CONNECTION=sqlite y una base propia en
// api/database/e2e.sqlite, y el migrate:fresh usa --database=sqlite de forma
// explícita: aunque api/.env apuntara a Neon (como cuando se hacen pruebas
// contra producción), esto nunca toca otra base de datos que ese fichero.
const apiDir = path.resolve(webDir, '../api')
const e2eDb = path.join(apiDir, 'database', 'e2e.sqlite')

// Solo se crea si no existe (touch): este fichero se vuelve a cargar en cada
// proceso de test, y vaciarla aquí borraría lo que el API ya migró.
// `migrate:fresh` (abajo) deja el esquema limpio en cada ejecución.
fs.closeSync(fs.openSync(e2eDb, 'a'))

const apiEnv = {
  DB_CONNECTION: 'sqlite',
  DB_DATABASE: e2eDb,
  APP_ENV: 'local',
  APP_DEBUG: 'false',
  CACHE_STORE: 'array',
  SESSION_DRIVER: 'array',
  QUEUE_CONNECTION: 'sync',
  MAIL_MAILER: 'log',
  SENTRY_LARAVEL_DSN: '',
}

export default defineConfig({
  testDir: './e2e',
  // Un solo worker: comparten la base de datos del API y el estado es más
  // fácil de razonar. Son pocos tests y rápidos.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: APP_URL,
    // El Chrome ya instalado (en local y en los runners de GitHub), sin
    // descargar un navegador aparte.
    channel: 'chrome',
    trace: 'retain-on-failure',
    locale: 'es-ES',
  },
  webServer: [
    {
      command: `php artisan migrate:fresh --database=sqlite --force && php artisan serve --host=127.0.0.1 --port=${API_PORT} --no-reload`,
      cwd: apiDir,
      env: apiEnv,
      url: `http://127.0.0.1:${API_PORT}/up`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: webDir,
      env: { VITE_API_URL: API_URL },
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
