import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { serviceWorker } from './vite.sw'
import tailwindcss from '@tailwindcss/vite'

// Política de seguridad de contenido (CSP) puesta como <meta> en el HTML del
// build: GitHub Pages no deja configurar cabeceras HTTP, y esto es lo que sí
// se puede. Solo se aplica al build (en desarrollo, Vite inyecta scripts en
// línea para el HMR y la política los bloquearía).
//
//  - Scripts: solo los del propio origen y el script en línea de index.html
//    (que restaura la ruta tras un 404 de GitHub Pages), identificado por su
//    hash: así un script inyectado en la página no se ejecuta.
//  - connect-src: solo el propio origen y el API (el origen de VITE_API_URL).
//  - Imágenes: cualquier https (las fotos de hitos vienen con una URL
//    temporal de R2), data: (avatares) y blob:.
//  - Estilos con 'unsafe-inline': Vue y la app ponen atributos `style`.
//  - Google Fonts (la hoja de estilos de la fuente Quicksand y sus archivos):
//    el único recurso externo de la app, `@import` en assets/base.css.
//
// `frame-ancestors` no se puede fijar desde un <meta> (el navegador lo ignora).
function contentSecurityPolicy(apiUrl: string, sentryDsn?: string): Plugin {
  return {
    name: 'pequedex-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inlineScriptHashes = [
          ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
        ].map(
          (match) =>
            `'sha256-${createHash('sha256')
              .update(match[1] ?? '')
              .digest('base64')}'`,
        )
        const apiOrigin = new URL(apiUrl).origin
        // El DSN de Sentry (`https://clave@oXXX.ingest.sentry.io/id`): solo se
        // permite conectar con su servidor de ingesta, y solo si el build lo lleva.
        const sentryOrigin = sentryDsn ? `https://${new URL(sentryDsn).host}` : ''

        const policy = [
          "default-src 'self'",
          `script-src 'self' ${inlineScriptHashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob:",
          "font-src 'self' data: https://fonts.gstatic.com",
          `connect-src 'self' ${apiOrigin} ${sentryOrigin}`.trim(),
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')

        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // GitHub Pages sirve un project page bajo /PequeDex/, no en la raíz del
    // dominio (a diferencia de Cloudflare Pages) - vue-router ya lee esto vía
    // import.meta.env.BASE_URL (ver router/index.ts), así que basta con fijarlo
    // aquí una vez.
    base: '/PequeDex/',
    plugins: [
      vue(),
      vueDevTools(),
      tailwindcss(),
      // Mismo valor por defecto que `lib/api.ts`.
      contentSecurityPolicy(env.VITE_API_URL ?? 'http://localhost:8000/api', env.VITE_SENTRY_DSN),
      // Genera sw.js (service worker) con la lista de ficheros de la app.
      serviceWorker(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
