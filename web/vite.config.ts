import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve un project page bajo /PequeDex/, no en la raíz del
  // dominio (a diferencia de Cloudflare Pages) - vue-router ya lee esto vía
  // import.meta.env.BASE_URL (ver router/index.ts), así que basta con fijarlo
  // aquí una vez.
  base: '/PequeDex/',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
