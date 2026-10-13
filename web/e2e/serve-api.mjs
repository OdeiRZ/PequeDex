// Arranca el API de Laravel para las pruebas e2e y lo mantiene vivo.
//
// Antes Playwright lanzaba `php artisan serve` directamente. Una vez, en CI,
// ese servidor murió entre dos tests (los cuatro siguientes recibieron
// ECONNREFUSED) sin dejar ningún mensaje, y la causa no se pudo saber. Este
// script lo hace más robusto sin esconder el fallo: si el servidor se cae, lo
// vuelve a levantar enseguida y deja constancia en el registro (stderr, que
// Playwright muestra), para que se vea cuándo y con qué código ocurrió.
//
// Uso: node serve-api.mjs <puerto>   (con el cwd en api/ y las variables del
// API en el entorno, como las pone playwright.config.ts).
import { spawn, spawnSync } from 'node:child_process'

const port = process.argv[2]
if (!port) {
  console.error('[e2e api] Falta el puerto: node serve-api.mjs <puerto>')
  process.exit(2)
}

// Esquema limpio en cada ejecución, siempre sobre la SQLite desechable.
const migrate = spawnSync('php', ['artisan', 'migrate:fresh', '--database=sqlite', '--force'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
if (migrate.status !== 0) {
  console.error(`[e2e api] migrate:fresh falló (código ${migrate.status})`)
  process.exit(migrate.status ?? 1)
}

let stopping = false
let child
let restarts = 0
const MAX_RESTARTS = 5

function start() {
  child = spawn('php', ['artisan', 'serve', '--host=127.0.0.1', `--port=${port}`, '--no-reload'], {
    // Sin el volcado de cada petición (sería ruido); sí los errores.
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  child.on('exit', (code, signal) => {
    if (stopping) return
    restarts += 1
    console.error(
      `[e2e api] El servidor se ha caído (código ${code}, señal ${signal}); reinicio ${restarts}/${MAX_RESTARTS}`,
    )
    if (restarts > MAX_RESTARTS) process.exit(1)
    setTimeout(start, 300)
  })
}

function stop() {
  stopping = true
  child?.kill()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
