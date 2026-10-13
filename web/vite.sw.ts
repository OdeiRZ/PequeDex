import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

// Genera `sw.js` en el build a partir de `sw/sw.template.js`: le inyecta la lista
// de ficheros de la app que debe guardar y una versión derivada del contenido de
// todos ellos, de modo que el service worker cambia (y los navegadores lo
// actualizan) exactamente cuando cambia algo de la app, y nunca si no.
//
// Va fuera de `public/` a propósito: un `public/sw.js` se copiaría tal cual y
// no sabría qué ficheros hay.

/** Lo de `public/` que NO se guarda: los audios (enormes, se piden por rangos) y
 * lo que no forma parte de la app (el propio sw.js y la 404 de GitHub Pages). */
const PUBLIC_EXCLUDES = [/^sounds\//, /^sw\.js$/, /^404\.html$/]

function hash(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  )
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'pequedex-service-worker',
    apply: 'build',
    // Después del plugin que emite index.html (ya con el CSP puesto).
    enforce: 'post',

    configResolved(resolved) {
      config = resolved
    },

    generateBundle(_options, bundle) {
      // ruta relativa al scope -> huella de su contenido
      const files = new Map<string, string>()

      for (const [fileName, item] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue
        const source = item.type === 'chunk' ? item.code : item.source
        // El index.html se sirve en la raíz del scope.
        files.set(fileName === 'index.html' ? './' : fileName, hash(source))
      }

      if (config.publicDir) {
        for (const relative of listFiles(config.publicDir)) {
          if (PUBLIC_EXCLUDES.some((exclude) => exclude.test(relative))) continue
          files.set(relative, hash(readFileSync(path.join(config.publicDir, relative))))
        }
      }

      const urls = [...files.keys()].sort()
      // La versión depende del contenido de TODOS los ficheros guardados.
      const version = hash(urls.map((url) => `${url}:${files.get(url)}`).join('\n')).slice(0, 16)

      const template = readFileSync(path.resolve(config.root, 'sw/sw.template.js'), 'utf8')
      const source = template
        .replace('__SW_VERSION__', version)
        .replace('__PRECACHE_MANIFEST__', JSON.stringify(urls, null, 2))

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}
