import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

// Carga la plantilla real del service worker (sw/sw.template.js) en un entorno
// simulado (sin navegador) y le lanza eventos como lo haría el navegador.
const template = readFileSync(path.resolve(process.cwd(), 'sw/sw.template.js'), 'utf8')

const SCOPE = 'https://odeirz.github.io/PequeDex/'
const API = 'https://pequedex-0phw.onrender.com/api/babies'

type Handler = (event: Record<string, unknown>) => void

function setup(
  options: { precache?: string[]; version?: string; remote?: Record<string, number> } = {},
) {
  const handlers: Record<string, Handler> = {}
  const stores = new Map<string, Map<string, Response>>()
  const fetched: Request[] = []
  const matchOptions: ({ ignoreVary?: boolean } | undefined)[] = []
  const remote = options.remote ?? {}

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        // Como la Cache API real: cada `match` devuelve una copia que se puede leer.
        match: async (key: Request | string, options?: { ignoreVary?: boolean }) => {
          matchOptions.push(options)
          return store.get(typeof key === 'string' ? key : key.url)?.clone()
        },
        put: async (key: Request | string, response: Response) => {
          store.set(typeof key === 'string' ? key : key.url, response)
        },
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  }

  const fakeFetch = async (input: Request | string) => {
    const request = typeof input === 'string' ? new Request(input) : input
    fetched.push(request)
    const status = remote[request.url] ?? 200
    return new Response(`contenido de ${request.url}`, { status })
  }

  const skipWaiting = vi.fn()
  const claim = vi.fn(async () => {})
  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://odeirz.github.io' },
    clients: { claim },
    skipWaiting,
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
  }

  const code = template
    .replace('__SW_VERSION__', options.version ?? 'v1')
    .replace(
      '__PRECACHE_MANIFEST__',
      JSON.stringify(options.precache ?? ['./', 'assets/app-abc.js']),
    )
  vm.runInNewContext(code, { self, caches, fetch: fakeFetch, Request, Response, URL, Promise })

  /** Dispara un evento con waitUntil y devuelve la promesa que el service worker registró. */
  async function run(
    type: 'install' | 'activate' | 'message',
    extra: Record<string, unknown> = {},
  ) {
    let pending: Promise<unknown> = Promise.resolve()
    handlers[type]!({ waitUntil: (p: Promise<unknown>) => (pending = p), ...extra })
    await pending
  }

  /** Lanza un fetch; devuelve la respuesta del service worker o `null` si lo dejó pasar. */
  async function fetchEvent(url: string, init: RequestInit & { mode?: RequestMode } = {}) {
    const { mode, ...rest } = init
    const request = new Request(url, rest)
    // `new Request` no deja crear mode "navigate" (solo lo pone el navegador):
    // se simula fijando la propiedad en el objeto.
    const effective =
      mode === 'navigate' ? Object.defineProperty(request, 'mode', { value: 'navigate' }) : request
    // En un objeto: TypeScript no ve las asignaciones hechas desde el callback.
    const result: { response: Promise<Response> | null } = { response: null }
    handlers.fetch!({
      request: effective,
      respondWith: (p: Promise<Response>) => (result.response = p),
    })
    return result.response === null ? null : await result.response
  }

  return { run, fetchEvent, stores, fetched, matchOptions, skipWaiting, claim }
}

describe('service worker', () => {
  it('guarda todos los ficheros de la app al instalarse, saltándose la caché HTTP', async () => {
    const sw = setup({ precache: ['./', 'assets/app-abc.js', 'icons/icon-192.png'] })

    await sw.run('install')

    expect([...sw.stores.get('pequedex-shell-v1')!.keys()].sort()).toEqual([
      `${SCOPE}`,
      `${SCOPE}assets/app-abc.js`,
      `${SCOPE}icons/icon-192.png`,
    ])
    // GitHub Pages cachea 10 min: un index.html viejo apuntaría a ficheros ya borrados.
    expect(sw.fetched.every((request) => request.cache === 'reload')).toBe(true)
  })

  it('falla la instalación entera si un solo fichero no se puede guardar', async () => {
    const sw = setup({ remote: { [`${SCOPE}assets/app-abc.js`]: 404 } })

    await expect(sw.run('install')).rejects.toThrow(/404/)
  })

  it('no toca el API, las escrituras, los audios ni las peticiones por rangos', async () => {
    const sw = setup()
    await sw.run('install')

    expect(await sw.fetchEvent(API)).toBeNull()
    expect(await sw.fetchEvent(`${SCOPE}api`, { method: 'POST' })).toBeNull()
    expect(await sw.fetchEvent(`${SCOPE}sounds/rain.mp3`)).toBeNull()
    expect(
      await sw.fetchEvent(`${SCOPE}assets/app-abc.js`, { headers: { range: 'bytes=0-' } }),
    ).toBeNull()
    expect(await sw.fetchEvent('https://otro-sitio.example/script.js')).toBeNull()
  })

  it('abre cualquier pantalla de la app sin red con el index guardado', async () => {
    const sw = setup()
    await sw.run('install')
    sw.fetched.length = 0

    for (const route of ['', 'estadisticas', 'vacunas', 'verify-email']) {
      const response = await sw.fetchEvent(`${SCOPE}${route}`, { mode: 'navigate' })
      expect(await response!.text()).toBe(`contenido de ${SCOPE}`)
    }
    expect(sw.fetched).toHaveLength(0) // ninguna fue a la red
  })

  it('no confunde un fichero con una pantalla: un enlace directo al manifiesto no devuelve el index', async () => {
    const sw = setup({ precache: ['./', 'manifest.webmanifest'] })
    await sw.run('install')

    const response = await sw.fetchEvent(`${SCOPE}manifest.webmanifest`, { mode: 'navigate' })

    expect(await response!.text()).toBe(`contenido de ${SCOPE}manifest.webmanifest`)
  })

  it('sirve los ficheros guardados desde la caché y trae de la red los que no lo están', async () => {
    const sw = setup()
    await sw.run('install')
    sw.fetched.length = 0

    expect(await (await sw.fetchEvent(`${SCOPE}assets/app-abc.js`))!.text()).toContain('app-abc.js')
    expect(sw.fetched).toHaveLength(0)

    await sw.fetchEvent(`${SCOPE}assets/nuevo-xyz.js`)
    expect(sw.fetched.map((request) => request.url)).toEqual([`${SCOPE}assets/nuevo-xyz.js`])
    // y la siguiente vez ya está guardado
    expect(sw.stores.get('pequedex-shell-v1')!.has(`${SCOPE}assets/nuevo-xyz.js`)).toBe(true)
  })

  it('al activarse borra el armazón de versiones anteriores, no las fuentes, y toma el control', async () => {
    const sw = setup({ version: 'v2' })
    for (const name of [
      'pequedex-shell-v1',
      'pequedex-fonts-v1',
      'pequedex-shell-v2',
      'otra-cosa',
    ]) {
      await (
        await (async () => ({ open: async () => null }))()
      ).open
      sw.stores.set(name, new Map())
    }

    await sw.run('activate')

    expect([...sw.stores.keys()].sort()).toEqual([
      'otra-cosa',
      'pequedex-fonts-v1',
      'pequedex-shell-v2',
    ])
    expect(sw.claim).toHaveBeenCalled()
  })

  it('ignora la cabecera Vary al buscar en la caché (un servidor con Vary: Origin la hacía fallar)', async () => {
    const sw = setup()
    await sw.run('install')
    sw.matchOptions.length = 0

    await sw.fetchEvent(`${SCOPE}assets/app-abc.js`)
    await sw.fetchEvent(`${SCOPE}estadisticas`, { mode: 'navigate' })

    expect(sw.matchOptions).toHaveLength(2)
    expect(sw.matchOptions.every((options) => options?.ignoreVary === true)).toBe(true)
  })

  it('no se activa solo: espera el mensaje SKIP_WAITING', async () => {
    const sw = setup()
    await sw.run('install')
    expect(sw.skipWaiting).not.toHaveBeenCalled()

    await sw.run('message', { data: { type: 'SKIP_WAITING' } })
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)

    await sw.run('message', { data: { type: 'otra-cosa' } })
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('ya no toca las fuentes de Google (van con la app) y borra su caché antigua', async () => {
    const sw = setup()
    await sw.run('install')
    sw.stores.set('pequedex-fonts-v1', new Map())

    await sw.run('activate')

    expect(sw.stores.has('pequedex-fonts-v1')).toBe(false)
    expect(sw.stores.has('pequedex-shell-v1')).toBe(true)
    expect(await sw.fetchEvent('https://fonts.gstatic.com/s/quicksand/v1/font.woff2')).toBeNull()
  })
})
